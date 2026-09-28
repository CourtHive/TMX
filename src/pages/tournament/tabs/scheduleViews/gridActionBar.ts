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
import { buildVenueFrameNotice } from 'components/notices/venueFrameNotice';
import tippy from 'tippy.js';
import { badgeSeverity } from './scheduleIssueSeverity';
import { preferredCellFor } from './scheduleCellLookup';
import { providerConfig } from 'config/providerConfig';
import { buildLegendButton } from './scheduleLegend';
import { t } from 'i18n';
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
const CURSOR_POINTER = 'cursor: pointer';

export interface GridActionBarParams {
  issues: ScheduleIssue[];
  bulkMode: boolean;
  minCourtWidth: number;
  onMinCourtWidthChange: (width: number) => void;
  onBulkModeChange: (enabled: boolean) => void;
  onClearSchedule?: (target: HTMLElement) => void;
  /** Open the bulk Lock / Unlock menu for the viewed date. Omitted ⇒ no button. */
  onScheduleLock?: (target: HTMLElement) => void;
  /** Whether any matchUp has been called to court (Call Timing Variance has data). */
  timingAvailable?: boolean;
  /** Open the Call Timing Variance report. When omitted, the shortcut never renders. */
  onOpenTimingReport?: () => void;
  /** Whether warning-severity issues currently decorate their grid cells. */
  warningBarsVisible?: boolean;
  /**
   * Persist and apply a new warning-bars preference. Omitted ⇒ the toggle never
   * renders, so a caller that cannot redraw the grid cannot offer a control that
   * would appear to do nothing.
   */
  onWarningBarsChange?: (visible: boolean) => void;
  /** Whether the currently-viewed date's order of play is published. */
  datePublished?: boolean;
  /** Toggle publication of the viewed date. When omitted, the publish pill never renders. */
  onTogglePublish?: () => void;
  /**
   * Called after the venue-frame notice's Edit Dates modal saves. Every clock on
   * the page is resolved against the tournament's zone, so setting one has to
   * re-render the grid rather than wait for the next refresh.
   */
  onVenueTimeZoneSet?: () => void;
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
  /**
   * Re-render the publish pill after a publish/unpublish toggle so the footer
   * reflects the new state without rebuilding the bar. No-op without onTogglePublish.
   */
  setDatePublished: (published: boolean) => void;
  /**
   * Re-evaluate the venue-frame notice against the current tournament record.
   *
   * The notice is the one control in this bar whose own action removes it: the
   * modal it opens sets `localTimeZone`, after which `buildVenueFrameNotice`
   * returns null. Without this the pill outlived a successful save — the grid
   * re-rendered in the new zone while the footer still said the zone was unset,
   * which reads as "Save did nothing".
   */
  setVenueFrame: () => void;
}

export function buildGridActionBar(params: GridActionBarParams): GridActionBar {
  const { issues, bulkMode, minCourtWidth, onMinCourtWidthChange, onBulkModeChange, onClearSchedule } = params;
  const { timingAvailable, onOpenTimingReport, datePublished, onTogglePublish, onScheduleLock } = params;
  const { warningBarsVisible, onWarningBarsChange } = params;

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
  // Built fresh on every `setIssues` rather than captured once. A redraw rebuilds the
  // button and its popover, and a checkbox built from the ORIGINAL prop would flip back
  // to the old state the first time conflicts changed — silently disagreeing with the
  // grid it governs. Undefined without a handler: a control that cannot act must not be
  // offered.
  let barsVisible = warningBarsVisible !== false;
  const warningBarsControl = (): WarningBarsControl | undefined =>
    onWarningBarsChange && {
      visible: barsVisible,
      onChange: (visible: boolean) => {
        barsVisible = visible;
        onWarningBarsChange(visible);
      },
    };
  const setIssues = (next: ScheduleIssue[]): void => {
    issuesSlot.replaceChildren();
    if (next.length > 0) issuesSlot.appendChild(buildIssuesButton(next, warningBarsControl()));
  };
  bar.appendChild(issuesSlot);
  setIssues(issues);

  // Venue-frame notice — only when the tournament carries no time zone, so every
  // clock on this page is being read off the operator's device. Its own
  // `display: contents` slot: null (not an empty box) once a zone is set, so no
  // flex gap is reserved, and setVenueFrame can drop it in place once saved.
  const venueSlot = document.createElement('div');
  venueSlot.style.display = 'contents';
  const setVenueFrame = (): void => {
    venueSlot.replaceChildren();
    const venueNotice = buildVenueFrameNotice(params.onVenueTimeZoneSet);
    if (venueNotice) venueSlot.appendChild(venueNotice);
  };
  bar.appendChild(venueSlot);
  setVenueFrame();

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

  // Order-of-play publish pill — immediately right of the timing shortcut. Its
  // own `display: contents` slot so setDatePublished can re-render it in place
  // after a toggle without disturbing neighbouring controls.
  const publishSlot = document.createElement('div');
  publishSlot.style.display = 'contents';
  let publishState = !!datePublished;
  const setDatePublished = (published: boolean): void => {
    publishState = published;
    publishSlot.replaceChildren();
    if (onTogglePublish) publishSlot.appendChild(buildPublishPill(published, onTogglePublish));
  };
  bar.appendChild(publishSlot);
  setDatePublished(publishState);

  // Spacer pushes the right cluster (bulk-mode toggle + clear button) flush
  // right while the left cluster stays anchored at the start of the bar.
  const spacer = document.createElement('div');
  spacer.style.cssText = 'flex: 1;';
  bar.appendChild(spacer);

  // Right cluster
  if (providerConfig.isAllowed('canUseBulkScheduling')) {
    bar.appendChild(buildBulkModeToggle(bulkMode, onBulkModeChange));
  }
  if (onScheduleLock) {
    bar.appendChild(buildScheduleLockButton(bulkMode, onScheduleLock));
  }
  if (onClearSchedule) {
    bar.appendChild(buildClearButton(bulkMode, onClearSchedule));
  }
  // Last in the right cluster, and unconditional: it is the one control here
  // that explains the others, so it must not be the one that disappears with a
  // capability or an empty state.
  bar.appendChild(buildLegendButton());

  return { element: bar, setIssues, setTimingAvailable, setDatePublished, setVenueFrame };
}

// ── Order-of-play publish pill ──

const PUBLISH_GLOW_STYLE_ID = 'spl-publish-glow-style';

// Inject the green publish-glow keyframes once (inline styles can't declare @keyframes).
function ensurePublishGlowStyle(): void {
  if (document.getElementById(PUBLISH_GLOW_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PUBLISH_GLOW_STYLE_ID;
  style.textContent =
    '@keyframes spl-publish-glow{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}50%{box-shadow:0 0 8px 2px rgba(34,197,94,0.55)}}' +
    '.spl-publish-pill--on{animation:spl-publish-glow 2.6s ease-in-out infinite}' +
    '@media (prefers-reduced-motion: reduce){.spl-publish-pill--on{animation:none}}';
  document.head.appendChild(style);
}

/**
 * Two-state pill for the viewed date's order-of-play publish status:
 *   - published → green, softly glowing "Published" (click to unpublish)
 *   - not       → muted grey "Not published" (click to publish)
 * Click routes to the confirm dialog owned by the caller.
 */
function buildPublishPill(published: boolean, onToggle: () => void): HTMLElement {
  ensurePublishGlowStyle();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = published ? 'spl-publish-pill spl-publish-pill--on' : 'spl-publish-pill';
  const accent = published ? 'var(--tmx-accent-green, #22c55e)' : 'var(--tmx-text-muted, #9ca3af)';
  btn.style.cssText = [
    'font-size: 0.75rem',
    'font-weight: 600',
    'padding: 4px 10px',
    BORDER_RADIUS_6,
    `border: 1px solid ${published ? accent : 'var(--tmx-border-primary)'}`,
    BG_PRIMARY,
    CURSOR_POINTER,
    `color: ${accent}`,
    DISPLAY_INLINE_FLEX,
    ALIGN_ITEMS_CENTER,
    'gap: 6px',
  ].join('; ');
  btn.title = published
    ? 'Order of play for this date is published — click to unpublish'
    : 'Order of play for this date is not published — click to publish';
  btn.setAttribute('aria-label', btn.title);
  const dot = published
    ? '<i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i>'
    : '<i class="fa-regular fa-circle" style="font-size: 0.5rem;"></i>';
  btn.innerHTML = `${dot}<span>${published ? 'Published' : 'Not published'}</span>`;
  btn.addEventListener('click', onToggle);
  return btn;
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
    CURSOR_POINTER,
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
    label: t('gridActions.minWidth'),
    initial,
    min: MIN_COURT_WIDTH_FLOOR,
    max: MIN_COURT_WIDTH_CEILING,
    step: MIN_COURT_WIDTH_STEP,
    suffix: 'px',
    title: t('gridActions.minWidthHint'),
    onChange,
  });
}

// ── Issues ──

/** The grid-decoration preference, as the issues popover needs to see it. */
interface WarningBarsControl {
  visible: boolean;
  onChange: (visible: boolean) => void;
}

/**
 * The count badge, coloured by what the issues actually ARE.
 *
 * It used to be `--tmx-fill-warning` unconditionally, which is a burnt orange-red that
 * reads as a fault — so a date carrying eighteen ordinary adjacency warnings looked
 * exactly like a date carrying eighteen faults, and the operator had to open the popover
 * to find out which. The severity was already in hand at this call site (the popover
 * below has painted per-row severity off `issue.severity` all along); nothing new is
 * queried.
 *
 * The two fills are `--tmx-fill-error` / `--tmx-fill-caution`, which exist to be told
 * apart and carry their own ink because a caution fill bright enough to read as amber
 * cannot carry white text at AA. Both are theme-invariant by design — see theme.css.
 */
function buildIssuesBadge(issues: ScheduleIssue[]): HTMLElement {
  const badge = document.createElement('span');
  const isError = badgeSeverity(issues) === 'ERROR';
  const fill = isError ? 'var(--tmx-fill-error, #b91c1c)' : 'var(--tmx-fill-caution, #f59e0b)';
  const ink = isError ? 'var(--tmx-text-inverse, #fff)' : 'var(--tmx-fill-caution-ink, #1c1917)';
  badge.style.cssText = `font-size: 0.625rem; font-weight: 700; padding: 1px 5px; border-radius: 10px; background: ${fill}; color: ${ink};`;
  // The colour is the message, and colour alone is not an accessible signal. The dataset
  // entry is what a screen reader's label and Journey 134 both read.
  badge.dataset.issueSeverity = isError ? 'ERROR' : 'WARN';
  badge.textContent = String(issues.length);
  return badge;
}

function buildIssuesButton(issues: ScheduleIssue[], warningBars?: WarningBarsControl): HTMLElement {
  const btn = document.createElement('button');
  // The icon follows the same rule as the badge. `--tmx-accent-*` rather than a fill:
  // this is a glyph on the bar's own background, not a filled chip, and the accent
  // family is the one tuned per theme for exactly that.
  const iconColor =
    badgeSeverity(issues) === 'ERROR'
      ? 'color: var(--tmx-accent-red, #ff6b6b)'
      : 'color: var(--tmx-accent-orange, #f59e0b)';
  btn.style.cssText = [
    'position: relative',
    'font-size: 0.875rem',
    'padding: 4px 8px',
    BORDER_RADIUS_6,
    BORDER_PRIMARY,
    BG_PRIMARY,
    CURSOR_POINTER,
    iconColor,
    DISPLAY_INLINE_FLEX,
    ALIGN_ITEMS_CENTER,
    'gap: 4px',
  ].join('; ');
  btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
  btn.title =
    badgeSeverity(issues) === 'ERROR' ? t('gridActions.issuesWithErrors') : t('gridActions.issuesWarningsOnly');

  btn.appendChild(buildIssuesBadge(issues));

  // Built on the next frame so the button is in the document when tippy measures it.
  // The instance is not bound: nothing here reads it, and tippy keeps its own reference
  // on the element, so binding it only to discard it was what the `void` was hiding.
  requestAnimationFrame(() => {
    tippy(btn, {
      content: buildIssuesPopover(issues, warningBars),
      trigger: 'click',
      interactive: true,
      placement: 'top-start',
      theme: 'light-border',
      appendTo: () => document.body,
      maxWidth: 400,
    });
  });

  return btn;
}

/**
 * The warning-bars toggle, in the popover header beside the count.
 *
 * It lives here rather than in the bar because this is where an operator is already
 * asking "what are these?" — and because the answer to "why is every cell yellow?" is
 * the list underneath it. Turning it off hides grid DECORATION only: every warning stays
 * in this list, because the operator still needs to be able to read them.
 */
function buildWarningBarsToggle(control: WarningBarsControl): HTMLElement {
  const label = document.createElement('label');
  label.style.cssText = `font-size: 0.6875rem; ${COLOR_PRIMARY}; ${CURSOR_POINTER}; ${DISPLAY_INLINE_FLEX}; ${ALIGN_ITEMS_CENTER}; gap: 5px; font-weight: 500;`;
  label.title = t('gridActions.warningBarsHint');

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = control.visible;
  toggle.style.cssText = 'cursor: pointer; accent-color: var(--tmx-accent-blue); margin: 0;';
  toggle.dataset.warningBarsToggle = 'true';
  toggle.addEventListener('change', () => control.onChange(toggle.checked));

  label.appendChild(toggle);
  label.appendChild(document.createTextNode(t('gridActions.warningBars')));
  return label;
}

function buildIssuesPopover(issues: ScheduleIssue[], warningBars?: WarningBarsControl): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 8px; max-height: 360px; overflow-y: auto; min-width: 280px;';

  const header = document.createElement('div');
  header.style.cssText = `display: flex; ${ALIGN_ITEMS_CENTER}; justify-content: space-between; gap: 12px; margin-bottom: 8px; width: 100%;`;

  const title = document.createElement('div');
  title.style.cssText = `font-weight: 700; font-size: 0.75rem; ${COLOR_PRIMARY};`;
  // `total`, not `count`: i18next treats `count` as the plural selector and would then
  // look for `issuesTitle_one` / `_other`, which do not exist — the key would resolve to
  // its own name in front of the operator.
  title.textContent = t('gridActions.issuesTitle', { total: issues.length });
  header.appendChild(title);

  if (warningBars) header.appendChild(buildWarningBarsToggle(warningBars));
  container.appendChild(header);

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
      // Deliberately NOT `data-matchup-id`. That attribute is the page's "a matchUp
      // is DRAWN here" vocabulary — `applyRelatedHighlight` and `locateMatchUp` both
      // query it document-wide — and a row in a popover is not a surface a highlight
      // should land on. This one only identifies the row.
      row.dataset.issueMatchUpId = issue.matchUpId;
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
        sep.textContent = t('gridActions.conflictsWith');
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

/**
 * Scroll the best cell for `matchUpIds` into view and pulse it. An issue names a
 * conflict rather than one matchUp, so several candidates arrive and only some may be
 * drawn on the viewed day; `preferredCellFor` picks among them.
 *
 * `preferredCellFor` rather than a `querySelector` over `.spl-grid-cell`: that selector
 * matches the active strip's duplicate copy too, and the strip comes FIRST in
 * document order. The old form therefore pulsed a sticky band that was already on
 * screen and scrolled nowhere, while the grid cell the operator had just been sent
 * to stayed wherever it was — on every issue click for a match still to be played,
 * which is most of them. Pinned by Journey 132.
 */
function scrollToMatchUp(matchUpIds: string[]): void {
  const cell = preferredCellFor(matchUpIds);
  if (!cell) return;

  cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

  cell.classList.remove(PULSE);
  // Reading a layout property flushes the class removal above, so re-adding it starts a
  // NEW animation instead of continuing the old one. The read is the point; the value is
  // not. `no-unused-expressions` is off in this repo, so it needs no `void` to sit here.
  cell.offsetWidth; //NOSONAR — forces the reflow that restarts the pulse
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

// ── Bulk Lock / Unlock menu trigger ──

function buildScheduleLockButton(bulkMode: boolean, onScheduleLock: (target: HTMLElement) => void): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = [
    'font-size: 0.8125rem',
    'padding: 5px 10px',
    BORDER_RADIUS_6,
    BORDER_PRIMARY,
    BG_PRIMARY,
    // Disabled in bulk mode for the same reason Clear is: these write directly
    // rather than joining the pending queue, so mixing them would apply half a
    // batch the operator has not saved.
    bulkMode
      ? 'color: var(--tmx-text-muted); cursor: not-allowed; opacity: 0.55;'
      : `${COLOR_PRIMARY}; cursor: pointer;`,
    DISPLAY_INLINE_FLEX,
    ALIGN_ITEMS_CENTER,
    'gap: 6px',
  ].join('; ');
  btn.disabled = bulkMode;
  btn.title = bulkMode ? t('schedule.exitBulkForLock') : t('schedule.lockActions');
  btn.innerHTML =
    '<i class="fa-solid fa-lock" style="font-size: 0.75rem;"></i>' +
    `${t('schedule.lockLabel')} <i class="fa-solid fa-chevron-down" style="font-size: 0.5625rem; opacity: 0.6;"></i>`;
  btn.addEventListener('click', () => {
    if (bulkMode) return;
    onScheduleLock(btn);
  });
  return btn;
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
