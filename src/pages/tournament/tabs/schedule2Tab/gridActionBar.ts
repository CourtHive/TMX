/**
 * Grid Action Bar — slim bottom strip beneath the court grid that hosts
 * footer controls:
 *
 *   - Left:    Issues button (warning triangle + count badge with a tippy popover)
 *   - Center:  Min cell-width stepper (controls the grid's min court column width)
 *   - Right:   Bulk mode toggle, Clear schedule menu trigger
 *
 * Matches the visual of the profile view's action bar so both views read
 * as a unified "panel + bottom strip" pair.
 */
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { providerConfig } from 'config/providerConfig';
import { ScheduleIssue } from 'courthive-components';
import { buildStepper } from './stepperControl';
import {
  MIN_COURT_WIDTH_FLOOR,
  MIN_COURT_WIDTH_CEILING,
  MIN_COURT_WIDTH_STEP,
} from 'services/schedulePreferences/userMinCourtWidth';

const PULSE = 'spl-cell--issue-pulse';
const DISPLAY_INLINE_FLEX = 'display: inline-flex';
const ALIGN_ITEMS_CENTER = 'align-items: center';
const COLOR_PRIMARY = 'color: var(--tmx-color-primary)';
const BORDER_PRIMARY = 'border: 1px solid var(--tmx-border-primary)';
const BG_PRIMARY = 'background: var(--tmx-bg-primary)';
const BORDER_RADIUS_6 = 'border-radius: 6px';

export interface GridActionBarParams {
  issues: ScheduleIssue[];
  bulkMode: boolean;
  minCourtWidth: number;
  onMinCourtWidthChange: (width: number) => void;
  onBulkModeChange: (enabled: boolean) => void;
  onClearSchedule?: (target: HTMLElement) => void;
  /** Whether any matchUp has been called to court (Call Timing Variance has data). */
  timingAvailable?: boolean;
  /** Open the Call Timing Variance report. When omitted, the shortcut never renders. */
  onOpenTimingReport?: () => void;
}

export interface GridActionBar {
  element: HTMLElement;
  /**
   * Re-render just the issues cluster (warning button + count + popover) in
   * place. Lets a refresh after a schedule change (e.g. a drag) surface new
   * conflicts live without rebuilding the stepper / bulk-mode / clear controls.
   */
  setIssues: (issues: ScheduleIssue[]) => void;
  /**
   * Show/hide the glowing Call Timing Variance shortcut as call data appears or
   * clears (e.g. after a match is called to court). No-op without onOpenTimingReport.
   */
  setTimingAvailable: (available: boolean) => void;
}

export function buildGridActionBar(params: GridActionBarParams): GridActionBar {
  const { issues, bulkMode, minCourtWidth, onMinCourtWidthChange, onBulkModeChange, onClearSchedule } = params;
  const { timingAvailable, onOpenTimingReport } = params;

  const bar = document.createElement('div');
  bar.style.cssText =
    'display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-top: 1px solid var(--sp-line, var(--tmx-border-secondary)); background: var(--sp-panel-bg, var(--tmx-bg-primary)); flex-wrap: wrap;';

  // Left cluster order: issues warning, then the min-cell-width stepper, then
  // the Call Timing Variance shortcut immediately to the stepper's right. Both
  // the issues warning and the timing shortcut live in `display: contents` slots
  // so they can be re-rendered in place (setIssues / setTimingAvailable) without
  // touching the stepper — and an empty slot generates no box and no flex gap,
  // so neighbouring controls don't shift when a slot is empty.
  const issuesSlot = document.createElement('div');
  issuesSlot.style.display = 'contents';
  const setIssues = (next: ScheduleIssue[]): void => {
    issuesSlot.replaceChildren();
    if (next.length > 0) issuesSlot.appendChild(buildIssuesButton(next));
  };
  bar.appendChild(issuesSlot);
  setIssues(issues);

  bar.appendChild(buildMinCourtWidthStepper(minCourtWidth, onMinCourtWidthChange));

  // Call Timing Variance shortcut — just right of the Min Width stepper.
  const timingSlot = document.createElement('div');
  timingSlot.style.display = 'contents';
  const setTimingAvailable = (available: boolean): void => {
    timingSlot.replaceChildren();
    if (available && onOpenTimingReport) timingSlot.appendChild(buildTimingReportButton(onOpenTimingReport));
  };
  bar.appendChild(timingSlot);
  setTimingAvailable(!!timingAvailable);

  // Spacer pushes the right cluster (bulk-mode toggle + clear button) flush
  // right while the left cluster stays anchored at the start of the bar.
  const spacer = document.createElement('div');
  spacer.style.cssText = 'flex: 1;';
  bar.appendChild(spacer);

  // Right cluster
  if (providerConfig.isAllowed('canUseBulkScheduling')) {
    bar.appendChild(buildBulkModeToggle(bulkMode, onBulkModeChange));
  }
  if (onClearSchedule) {
    bar.appendChild(buildClearButton(bulkMode, onClearSchedule));
  }

  return { element: bar, setIssues, setTimingAvailable };
}

// ── Call Timing Variance shortcut ──

const TIMING_GLOW_STYLE_ID = 'spl-timing-glow-style';

// Inject the subtle-glow keyframes once (inline styles can't declare @keyframes).
function ensureTimingGlowStyle(): void {
  if (document.getElementById(TIMING_GLOW_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TIMING_GLOW_STYLE_ID;
  style.textContent =
    '@keyframes spl-timing-glow{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}50%{box-shadow:0 0 9px 2px rgba(59,130,246,0.55)}}' +
    '.spl-timing-report-btn{animation:spl-timing-glow 2.4s ease-in-out infinite}' +
    '@media (prefers-reduced-motion: reduce){.spl-timing-report-btn{animation:none}}';
  document.head.appendChild(style);
}

function buildTimingReportButton(onOpen: () => void): HTMLElement {
  ensureTimingGlowStyle();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'spl-timing-report-btn';
  btn.style.cssText = [
    'font-size: 0.875rem',
    'padding: 4px 9px',
    BORDER_RADIUS_6,
    BORDER_PRIMARY,
    BG_PRIMARY,
    'cursor: pointer',
    'color: var(--tmx-accent-blue, #3b82f6)',
    DISPLAY_INLINE_FLEX,
    ALIGN_ITEMS_CENTER,
    'gap: 6px',
  ].join('; ');
  btn.title = 'Call timing variance available — view report';
  btn.setAttribute('aria-label', 'View call timing variance report');
  btn.innerHTML = '<i class="fa-solid fa-stopwatch"></i>';
  btn.addEventListener('click', onOpen);
  return btn;
}

// ── Min cell width ──

function buildMinCourtWidthStepper(initial: number, onChange: (width: number) => void): HTMLElement {
  return buildStepper({
    label: 'Min Width',
    initial,
    min: MIN_COURT_WIDTH_FLOOR,
    max: MIN_COURT_WIDTH_CEILING,
    step: MIN_COURT_WIDTH_STEP,
    suffix: 'px',
    title: 'Minimum court column width — cells grow wider when there is room',
    onChange,
  });
}

// ── Issues ──

function buildIssuesButton(issues: ScheduleIssue[]): HTMLElement {
  const btn = document.createElement('button');
  btn.style.cssText = [
    'position: relative',
    'font-size: 0.875rem',
    'padding: 4px 8px',
    BORDER_RADIUS_6,
    BORDER_PRIMARY,
    BG_PRIMARY,
    'cursor: pointer',
    'color: var(--tmx-accent-orange, #f59e0b)',
    DISPLAY_INLINE_FLEX,
    ALIGN_ITEMS_CENTER,
    'gap: 4px',
  ].join('; ');
  btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';

  const badge = document.createElement('span');
  badge.style.cssText =
    'font-size: 0.625rem; font-weight: 700; padding: 1px 5px; border-radius: 10px; background: var(--tmx-fill-warning, #c2410c); color: #fff;';
  badge.textContent = String(issues.length);
  btn.appendChild(badge);

  let inst: TippyInstance | undefined;
  requestAnimationFrame(() => {
    inst = tippy(btn, {
      content: buildIssuesPopover(issues),
      trigger: 'click',
      interactive: true,
      placement: 'top-start',
      theme: 'light-border',
      appendTo: () => document.body,
      maxWidth: 400,
    });
    void inst; //NOSONAR
  });

  return btn;
}

function buildIssuesPopover(issues: ScheduleIssue[]): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 8px; max-height: 360px; overflow-y: auto; min-width: 280px;';

  const title = document.createElement('div');
  title.style.cssText = `font-weight: 700; font-size: 0.75rem; margin-bottom: 8px; ${COLOR_PRIMARY};`;
  title.textContent = `Scheduling Issues (${issues.length})`;
  container.appendChild(title);

  const severityColors: Record<string, { bg: string; color: string }> = {
    ERROR: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    WARN: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    INFO: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  };

  const P1_COLOR = '#4fc3f7';
  const P2_COLOR = '#ffb74d';
  const MUTED = 'opacity: 0.7';

  for (const issue of issues.slice(0, 30)) {
    const row = document.createElement('div');
    row.style.cssText =
      'display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--tmx-border-primary, #e5e7eb);';

    if (issue.matchUpId) {
      row.style.cursor = 'pointer';
      const candidates = issue.conflictMatchUpIds || [issue.matchUpId];
      row.addEventListener('click', () => scrollToMatchUp(candidates));
    }

    const badge = document.createElement('span');
    const colors = severityColors[issue.severity] ?? severityColors.WARN;
    badge.style.cssText = `font-size: 0.5625rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap; background: ${colors.bg}; color: ${colors.color};`;
    badge.textContent = issue.severity;

    const msg = document.createElement('span');
    msg.style.cssText = `font-size: 0.6875rem; ${COLOR_PRIMARY}; line-height: 1.4;`;

    if (issue.participants) {
      if (issue.prefix) {
        const s = document.createElement('span');
        s.style.cssText = MUTED;
        s.textContent = issue.prefix;
        msg.appendChild(s);
      }
      const typeSpan = document.createElement('span');
      typeSpan.style.cssText = MUTED;
      typeSpan.textContent = (issue.issueType || '') + ': ';
      msg.appendChild(typeSpan);

      const p1 = document.createElement('span');
      p1.style.cssText = `color: ${P1_COLOR}; font-weight: 600;`;
      p1.textContent = issue.participants;
      msg.appendChild(p1);

      if (issue.conflictParticipants?.length) {
        const sep = document.createElement('span');
        sep.style.cssText = MUTED;
        sep.textContent = ' conflicts with ';
        msg.appendChild(sep);

        issue.conflictParticipants.forEach((cp, i) => {
          if (i > 0) {
            const comma = document.createElement('span');
            comma.style.cssText = MUTED;
            comma.textContent = ', ';
            msg.appendChild(comma);
          }
          const p2 = document.createElement('span');
          p2.style.cssText = `color: ${P2_COLOR}; font-weight: 600;`;
          p2.textContent = cp;
          msg.appendChild(p2);
        });
      }
    } else {
      msg.textContent = issue.message;
    }

    row.appendChild(badge);
    row.appendChild(msg);
    container.appendChild(row);
  }

  if (issues.length > 30) {
    const more = document.createElement('div');
    more.style.cssText = 'font-size: 0.6875rem; color: var(--tmx-muted); padding: 6px 0; text-align: center;';
    more.textContent = `…and ${issues.length - 30} more`;
    container.appendChild(more);
  }

  return container;
}

function scrollToMatchUp(matchUpIds: string[]): void {
  let cell: HTMLElement | null = null;
  for (const mid of matchUpIds) {
    cell = document.querySelector(`.spl-grid-cell[data-matchup-id="${mid}"]`);
    if (cell) break;
  }
  if (!cell) return;

  cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

  cell.classList.remove(PULSE);
  void cell.offsetWidth; //NOSONAR — force reflow so the pulse animation restarts
  cell.classList.add(PULSE);
  cell.addEventListener('animationend', () => cell.classList.remove(PULSE), { once: true });
}

// ── Bulk mode ──

function buildBulkModeToggle(bulkMode: boolean, onChange: (enabled: boolean) => void): HTMLElement {
  const label = document.createElement('label');
  label.style.cssText = `font-size: 0.75rem; ${COLOR_PRIMARY}; cursor: pointer; display: flex; align-items: center; gap: 6px;`;
  label.title = 'Queue changes, save all at once';

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = bulkMode;
  toggle.style.cssText = 'cursor: pointer; accent-color: var(--tmx-accent-blue);';
  toggle.addEventListener('change', () => onChange(toggle.checked));

  label.appendChild(toggle);
  label.appendChild(document.createTextNode('Bulk mode'));
  return label;
}

// ── Clear menu trigger ──

function buildClearButton(bulkMode: boolean, onClearSchedule: (target: HTMLElement) => void): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = [
    'font-size: 0.8125rem',
    'padding: 5px 10px',
    BORDER_RADIUS_6,
    BORDER_PRIMARY,
    BG_PRIMARY,
    bulkMode
      ? 'color: var(--tmx-text-muted); cursor: not-allowed; opacity: 0.55;'
      : `${COLOR_PRIMARY}; cursor: pointer;`,
    DISPLAY_INLINE_FLEX,
    ALIGN_ITEMS_CENTER,
    'gap: 6px',
  ].join('; ');
  btn.disabled = bulkMode;
  btn.title = bulkMode ? 'Exit bulk mode to use Clear actions' : 'Clear schedule data';
  btn.innerHTML =
    '<i class="fa-solid fa-eraser" style="font-size: 0.75rem;"></i>Clear <i class="fa-solid fa-chevron-down" style="font-size: 0.5625rem; opacity: 0.6;"></i>';
  btn.addEventListener('click', () => {
    if (bulkMode) return;
    onClearSchedule(btn);
  });
  return btn;
}
