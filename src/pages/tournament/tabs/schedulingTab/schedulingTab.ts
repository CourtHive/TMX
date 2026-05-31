/**
 * Scheduling workspace — Option C unified surface (in flight).
 *
 * Replaces the two previously-separate tabs (`/schedule2` and
 * `/venues/availability`) with a single workspace that switches between
 * three modes sharing a workspace-level bulk pending-methods queue.
 *
 * Routes:
 *   /tournament/:id/scheduling                   → default mode for today's date
 *   /tournament/:id/scheduling/:date             → grid mode (default)
 *   /tournament/:id/scheduling/:date/availability
 *   /tournament/:id/scheduling/:date/profile
 *   /tournament/:id/scheduling/:date/grid
 *
 * Old routes still work in this commit; 301 redirects land later.
 *
 * Modes today are placeholders that defer to the existing implementations
 * via simple re-rendering. The mode-internals migration (sharing the
 * workspace queue, sharing chrome) follows in the next commit.
 */

import { context } from 'services/context';
import { competitionEngine } from 'services/factory/engine';
import { resolveScheduleDate } from '../scheduleUtils';
import { subscribeQueue, hasUnsavedChanges, getPendingCount, savePending, discardPending, isBulkMode, setBulkMode } from 'services/schedulingWorkspace/queueService';

import { SCHEDULING_CONTAINER, SCHEDULING_CONTROL, SCHEDULING_TAB, TOURNAMENT } from 'constants/tmxConstants';

export type SchedulingMode = 'availability' | 'profile' | 'grid';

interface RenderSchedulingTabParams {
  scheduledDate?: string;
  mode?: SchedulingMode;
}

const VALID_MODES: SchedulingMode[] = ['availability', 'profile', 'grid'];
const DEFAULT_MODE: SchedulingMode = 'grid';

function isValidMode(value: string | undefined): value is SchedulingMode {
  return !!value && (VALID_MODES as string[]).includes(value);
}

let queueUnsubscribe: (() => void) | null = null;

export function renderSchedulingTab({ scheduledDate, mode }: RenderSchedulingTabParams = {}): void {
  const containerEl = document.getElementById(SCHEDULING_CONTAINER);
  const controlEl = document.getElementById(SCHEDULING_CONTROL) || undefined;
  if (!containerEl) return;

  const resolvedDate = scheduledDate || resolveScheduleDate();
  const resolvedMode: SchedulingMode = isValidMode(mode) ? mode : DEFAULT_MODE;

  containerEl.style.display = '';
  if (controlEl) controlEl.innerHTML = '';

  containerEl.innerHTML = '';
  containerEl.appendChild(buildHeader(resolvedDate, resolvedMode));
  containerEl.appendChild(buildModeStub(resolvedMode, resolvedDate));
  containerEl.appendChild(buildActionBarMount());

  // Subscribe so the action bar reflects bulk-queue changes from any mode.
  queueUnsubscribe?.();
  queueUnsubscribe = subscribeQueue(refreshActionBar);
  refreshActionBar();
}

export function destroySchedulingTab(): void {
  queueUnsubscribe?.();
  queueUnsubscribe = null;
}

function buildHeader(date: string, currentMode: SchedulingMode): HTMLElement {
  const header = document.createElement('div');
  header.className = 'scheduling-workspace-header';
  header.style.cssText = 'display: flex; gap: 12px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--tmx-border, #ddd);';

  const title = document.createElement('div');
  title.style.cssText = 'font-weight: 600;';
  title.textContent = `Scheduling — ${date}`;
  header.appendChild(title);

  const spacer = document.createElement('div');
  spacer.style.cssText = 'flex: 1;';
  header.appendChild(spacer);

  for (const mode of VALID_MODES) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = labelForMode(mode);
    tab.style.cssText = [
      'padding: 6px 14px',
      'border-radius: 4px',
      'border: 1px solid var(--tmx-border, #ccc)',
      `background: ${mode === currentMode ? 'var(--tmx-accent, #2563eb)' : 'transparent'}`,
      `color: ${mode === currentMode ? '#fff' : 'var(--tmx-text, #333)'}`,
      'cursor: pointer',
    ].join('; ');
    tab.addEventListener('click', () => navigateToMode(mode, date));
    header.appendChild(tab);
  }

  const bulkToggle = document.createElement('label');
  bulkToggle.style.cssText = 'display: flex; gap: 6px; align-items: center; margin-left: 12px; font-size: 0.85rem;';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = isBulkMode();
  checkbox.addEventListener('change', () => {
    setBulkMode(checkbox.checked);
  });
  bulkToggle.appendChild(checkbox);
  bulkToggle.appendChild(document.createTextNode('Bulk mode'));
  header.appendChild(bulkToggle);

  return header;
}

function labelForMode(mode: SchedulingMode): string {
  if (mode === 'availability') return 'Availability';
  if (mode === 'profile') return 'Profile';
  return 'Grid';
}

function navigateToMode(mode: SchedulingMode, date: string): void {
  const tournamentId = competitionEngine.getTournamentInfo()?.tournamentInfo?.tournamentId;
  if (!tournamentId) return;
  context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/${SCHEDULING_TAB}/${date}/${mode}`);
}

function buildModeStub(mode: SchedulingMode, date: string): HTMLElement {
  const stub = document.createElement('div');
  stub.style.cssText = 'padding: 24px; min-height: 60vh;';

  const heading = document.createElement('h2');
  heading.textContent = `${labelForMode(mode)} mode`;
  heading.style.cssText = 'margin: 0 0 8px;';
  stub.appendChild(heading);

  const sub = document.createElement('div');
  sub.style.cssText = 'color: var(--tmx-text-muted, #666); margin-bottom: 16px;';
  sub.textContent = `Date: ${date}`;
  stub.appendChild(sub);

  const note = document.createElement('div');
  note.style.cssText = 'padding: 12px; background: var(--tmx-surface, #f4f4f4); border-radius: 4px; color: var(--tmx-text-muted, #666); font-size: 0.9rem;';
  note.innerHTML = `This is a placeholder. Mode integration with the workspace queue is in flight — see <code>Mentat/planning/SCHEDULE2_AVAILABILITY_INTEGRATION.md</code>. Use the existing routes (<code>/schedule2/${date}</code>, <code>/venues/availability</code>) for live work until then.`;
  stub.appendChild(note);

  return stub;
}

let actionBarRef: HTMLElement | null = null;

function buildActionBarMount(): HTMLElement {
  actionBarRef = document.createElement('div');
  actionBarRef.style.cssText = 'position: sticky; bottom: 0; padding: 8px 12px; background: var(--tmx-surface, #f4f4f4); border-top: 1px solid var(--tmx-border, #ddd); display: none; gap: 12px; align-items: center;';
  return actionBarRef;
}

function refreshActionBar(): void {
  const bar = actionBarRef;
  if (!bar) return;
  if (!hasUnsavedChanges()) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }

  bar.style.display = 'flex';
  bar.innerHTML = '';

  const summary = document.createElement('div');
  summary.style.cssText = 'flex: 1; font-size: 0.9rem;';
  summary.textContent = `${getPendingCount()} unsaved change(s)`;
  bar.appendChild(summary);

  const discardBtn = document.createElement('button');
  discardBtn.type = 'button';
  discardBtn.textContent = 'Discard';
  discardBtn.style.cssText = 'padding: 6px 14px; cursor: pointer;';
  discardBtn.addEventListener('click', () => {
    void discardPending();
  });
  bar.appendChild(discardBtn);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'padding: 6px 14px; cursor: pointer; background: var(--tmx-accent, #2563eb); color: #fff; border: 0; border-radius: 4px;';
  saveBtn.addEventListener('click', () => {
    void savePending();
  });
  bar.appendChild(saveBtn);
}
