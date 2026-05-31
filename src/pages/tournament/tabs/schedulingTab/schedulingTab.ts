/**
 * Scheduling workspace — Option C unified surface (in flight).
 *
 * Replaces the two previously-separate tabs (`/schedule2` and
 * `/venues/availability`) with a single workspace that switches between
 * three modes sharing a workspace-level bulk pending-methods queue.
 *
 * Routes:
 *   /tournament/:id/scheduling                                    → default mode for today's date
 *   /tournament/:id/scheduling/:date                              → grid mode (default)
 *   /tournament/:id/scheduling/:date/availability
 *   /tournament/:id/scheduling/:date/profile
 *   /tournament/:id/scheduling/:date/grid
 *
 * Header (rendered into SCHEDULING_CONTROL) mirrors schedule2's `.sch2-header`
 * shape so the control bar visual is identical, with one extra segmented
 * option (Availability) on the line.
 *
 * Modes today are placeholders that defer to the existing implementations
 * via simple re-rendering. The mode-internals migration (sharing the
 * workspace queue, sharing chrome) follows in the next commit.
 */

import { context } from 'services/context';
import { competitionEngine } from 'services/factory/engine';
import { resolveScheduleDate } from '../scheduleUtils';
import { buildSchedulingHeader } from './schedulingHeader';
import {
  subscribeQueue,
  hasUnsavedChanges,
  getPendingCount,
  savePending,
  discardPending,
  isBulkMode,
  setBulkMode,
} from 'services/schedulingWorkspace/queueService';

import {
  SCHEDULING_CONTAINER,
  SCHEDULING_CONTROL,
  SCHEDULING_TAB,
  TOURNAMENT,
} from 'constants/tmxConstants';

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
  const controlEl = document.getElementById(SCHEDULING_CONTROL);
  const containerEl = document.getElementById(SCHEDULING_CONTAINER);
  if (!controlEl || !containerEl) return;

  const resolvedDate = scheduledDate || resolveScheduleDate();
  const resolvedMode: SchedulingMode = isValidMode(mode) ? mode : DEFAULT_MODE;
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange() ?? { startDate: '', endDate: '' };

  controlEl.innerHTML = '';
  containerEl.innerHTML = '';
  containerEl.style.display = '';

  const header = buildSchedulingHeader({
    selectedDate: resolvedDate,
    activeMode: resolvedMode,
    startDate: startDate ?? '',
    endDate: endDate ?? '',
    onDateChange: (date: string) => navigateTo(date, resolvedMode),
    onModeChange: (newMode: SchedulingMode) => navigateTo(resolvedDate, newMode),
  });
  controlEl.appendChild(header);

  containerEl.appendChild(buildModeStub(resolvedMode, resolvedDate));
  containerEl.appendChild(buildBulkToggleRow());
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

function navigateTo(date: string, mode: SchedulingMode): void {
  const tournamentId = competitionEngine.getTournamentInfo()?.tournamentInfo?.tournamentId;
  if (!tournamentId) return;
  context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/${SCHEDULING_TAB}/${date}/${mode}`);
}

function labelForMode(mode: SchedulingMode): string {
  if (mode === 'availability') return 'Availability';
  if (mode === 'profile') return 'Profile';
  return 'Grid';
}

function buildModeStub(mode: SchedulingMode, date: string): HTMLElement {
  const stub = document.createElement('div');
  stub.style.cssText = 'padding: 24px; min-height: 60vh;';

  const heading = document.createElement('h2');
  heading.textContent = `${labelForMode(mode)} mode`;
  heading.style.cssText = 'margin: 0 0 8px;';
  stub.appendChild(heading);

  const sub = document.createElement('div');
  sub.style.cssText = 'color: var(--tmx-text-muted, var(--tmx-muted, #666)); margin-bottom: 16px;';
  sub.textContent = `Date: ${date}`;
  stub.appendChild(sub);

  const note = document.createElement('div');
  note.style.cssText =
    'padding: 12px; background: var(--tmx-surface, var(--tmx-bg-secondary, #f4f4f4)); border-radius: 4px; color: var(--tmx-text-muted, var(--tmx-muted, #666)); font-size: 0.9rem;';
  note.innerHTML = `This is a placeholder. Mode integration with the workspace queue is in flight — see <code>Mentat/planning/SCHEDULE2_AVAILABILITY_INTEGRATION.md</code>. Use the existing routes (<code>/schedule2/${date}</code>, <code>/venues/availability</code>) for live work until then.`;
  stub.appendChild(note);

  return stub;
}

function buildBulkToggleRow(): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'padding: 0 24px 16px; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--tmx-text-muted, var(--tmx-muted, #666));';
  const label = document.createElement('label');
  label.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; cursor: pointer;';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = isBulkMode();
  checkbox.addEventListener('change', () => {
    setBulkMode(checkbox.checked);
  });
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode('Bulk mode (workspace-level queue)'));
  row.appendChild(label);
  return row;
}

let actionBarRef: HTMLElement | null = null;

function buildActionBarMount(): HTMLElement {
  actionBarRef = document.createElement('div');
  actionBarRef.style.cssText =
    'position: sticky; bottom: 0; padding: 8px 12px; background: var(--tmx-bg-secondary, #f4f4f4); border-top: 1px solid var(--tmx-border-primary, #ddd); display: none; gap: 12px; align-items: center;';
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
  saveBtn.style.cssText =
    'padding: 6px 14px; cursor: pointer; background: var(--tmx-fill-accent, #2563eb); color: #fff; border: 0; border-radius: 4px; font-weight: 600;';
  saveBtn.addEventListener('click', () => {
    void savePending();
  });
  bar.appendChild(saveBtn);
}
