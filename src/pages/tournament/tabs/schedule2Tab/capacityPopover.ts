/**
 * Schedule2 Row 3(b) — inline per-court hours popover.
 *
 * Click on the capacity meter in Profile opens a tippy popover anchored to
 * the badge. Each court active for the selected date renders with current
 * open/close times and a 24h visual window; the operator can extend or
 * contract the range in place and Save dispatches one
 * `MODIFY_COURT_AVAILABILITY` mutation per changed court through the
 * scheduling workspace queue. Doesn't leave Profile.
 *
 * Mutations flow through `queueService.executeMethods({ mode:
 * 'availability', methods })` so bulk mode batches alongside Grid / Profile
 * pending methods (Phase 0 save-model unification cleared the prerequisite
 * — see Mentat/planning/SCHEDULE2_AVAILABILITY_INTEGRATION.md row 3(b)).
 *
 * The popover footer keeps a "Open availability painter" affordance for
 * the deep-edit case (bulk paint across many dates / venues) — the popover
 * is the in-place quick fix, not the only editor.
 */
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { AvailabilityEngine } from 'tods-competition-factory';

import { competitionEngine } from 'services/factory/engine';
import { executeMethods } from 'services/schedulingWorkspace/queueService';
import { tmxToast } from 'services/notifications/tmxToast';

import { updateCourtDateAvailability } from './capacityPopoverLogic';
import { MODIFY_COURT_AVAILABILITY } from 'constants/mutationConstants';

interface CapacityPopoverOpts {
  anchor: HTMLElement;
  scheduledDate: string;
  onJumpToPainter: () => void;
  onApplied?: () => void;
}

interface CourtRow {
  courtId: string;
  venueId: string;
  venueName: string;
  courtName: string;
  initialStart: string;
  initialEnd: string;
  // Live values mutated by the time inputs; flushed on Save.
  currentStart: string;
  currentEnd: string;
  startInput: HTMLInputElement;
  endInput: HTMLInputElement;
  windowBar: HTMLDivElement;
  // The persisted court object (for building the new dateAvailability array
  // without losing entries for other dates or bookings on this date).
  court: any;
}

const DAY_START_MIN = 0;
const DAY_END_MIN = 24 * 60;

export function openCapacityPopover(opts: CapacityPopoverOpts): void {
  const { anchor, scheduledDate, onJumpToPainter, onApplied } = opts;

  const stateResult = competitionEngine.getState();
  const records = stateResult?.tournamentRecords ?? {};
  const tournamentRecord: any = Object.values(records)[0];
  if (!tournamentRecord) return;

  // Reuse the same engine init that profileView's adapter uses so the
  // popover's "current" times match what the capacity meter computed against.
  // Assign only on full success so a partial init (e.g. throw inside init)
  // doesn't leave us with a half-built engine that fails downstream queries.
  let engine: AvailabilityEngine | null = null;
  try {
    const candidate = new AvailabilityEngine();
    candidate.init(tournamentRecord, { dayStartTime: '06:00', dayEndTime: '22:00', slotMinutes: 15 });
    engine = candidate;
  } catch {
    // engine stays null — handled below
  }
  if (!engine) {
    tmxToast({ message: 'No courts configured for this tournament', intent: 'is-warning' });
    return;
  }

  const rows = collectCourtRows(tournamentRecord, engine, scheduledDate);
  // Forward declare the tippy instance so the popover content can request
  // its own close — used by the "Open availability painter" footer link,
  // which must dismiss before navigating away or the popover would linger
  // on the next route.
  let tip: TippyInstance | null = null;
  const requestClose = () => tip?.hide();
  const content = buildPopoverContent(rows, scheduledDate, onJumpToPainter, onApplied, tournamentRecord, requestClose);

  tip = tippy(anchor, {
    content,
    trigger: 'manual',
    interactive: true,
    placement: 'bottom-start',
    theme: 'light-border',
    appendTo: () => document.body,
    maxWidth: 'none',
    onHidden: (instance) => {
      instance.destroy();
    },
  });
  tip.show();
}

function collectCourtRows(
  tournamentRecord: any,
  engine: AvailabilityEngine,
  scheduledDate: string,
): CourtRow[] {
  const rows: CourtRow[] = [];
  const venues = Array.isArray(tournamentRecord.venues) ? tournamentRecord.venues : [];
  for (const venue of venues) {
    const courts = Array.isArray(venue.courts) ? venue.courts : [];
    for (const court of courts) {
      const avail = engine.getCourtAvailability(
        { tournamentId: tournamentRecord.tournamentId, venueId: venue.venueId, courtId: court.courtId },
        scheduledDate,
      );
      const initialStart = avail?.startTime ?? '08:00';
      const initialEnd = avail?.endTime ?? '20:00';
      rows.push({
        courtId: court.courtId,
        venueId: venue.venueId,
        venueName: venue.venueName ?? venue.venueAbbreviation ?? '',
        courtName: court.courtName ?? court.courtId,
        initialStart,
        initialEnd,
        currentStart: initialStart,
        currentEnd: initialEnd,
        // populated below
        startInput: null as any,
        endInput: null as any,
        windowBar: null as any,
        court,
      });
    }
  }
  return rows;
}

function buildPopoverContent(
  rows: CourtRow[],
  scheduledDate: string,
  onJumpToPainter: () => void,
  onApplied: (() => void) | undefined,
  tournamentRecord: any,
  requestClose: () => void,
): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText = [
    'padding: 10px 12px',
    'min-width: 320px',
    'max-width: 380px',
    'max-height: 60vh',
    'overflow-y: auto',
    'display: flex',
    'flex-direction: column',
    'gap: 8px',
  ].join('; ');

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: baseline; justify-content: space-between;';
  const title = document.createElement('div');
  title.style.cssText = 'font-weight: 700; font-size: 0.8125rem;';
  title.textContent = `Court hours · ${scheduledDate}`;
  const subtitle = document.createElement('div');
  subtitle.style.cssText = 'font-size: 0.6875rem; color: var(--tmx-text-muted);';
  subtitle.textContent = `${rows.length} court${rows.length === 1 ? '' : 's'}`;
  header.appendChild(title);
  header.appendChild(subtitle);
  root.appendChild(header);

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size: 0.75rem; color: var(--tmx-text-muted); padding: 8px 0;';
    empty.textContent = 'No courts configured. Add courts via Venues.';
    root.appendChild(empty);
    return root;
  }

  // Rows
  const rowsHost = document.createElement('div');
  rowsHost.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
  for (const row of rows) rowsHost.appendChild(buildCourtRow(row));
  root.appendChild(rowsHost);

  // Footer: actions + jump-to-painter
  const footer = document.createElement('div');
  footer.style.cssText =
    'display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 8px; border-top: 1px solid var(--tmx-border-primary);';
  const jump = document.createElement('button');
  jump.type = 'button';
  jump.style.cssText =
    'font-size: 0.75rem; background: transparent; color: var(--tmx-fill-accent, #2563eb); border: none; padding: 4px 0; cursor: pointer; text-decoration: underline;';
  jump.textContent = 'Open availability painter →';
  jump.addEventListener('click', () => {
    // Dismiss before navigating; tippy popovers don't auto-hide on route
    // change and would linger over the painter mode otherwise.
    requestClose();
    onJumpToPainter();
  });

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 6px;';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.style.cssText =
    'font-size: 0.75rem; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--tmx-fill-accent, #2563eb); background: var(--tmx-fill-accent, #2563eb); color: #fff; font-weight: 600; cursor: pointer;';
  saveBtn.textContent = 'Apply';
  saveBtn.addEventListener('click', () => {
    void applyChanges(rows, scheduledDate, tournamentRecord, onApplied);
  });
  actions.appendChild(saveBtn);

  footer.appendChild(jump);
  footer.appendChild(actions);
  root.appendChild(footer);

  return root;
}

function buildCourtRow(row: CourtRow): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display: flex; flex-direction: column; gap: 4px; padding: 6px 8px; border: 1px solid var(--tmx-border-primary); border-radius: 6px;';

  const label = document.createElement('div');
  label.style.cssText = 'display: flex; justify-content: space-between; align-items: baseline;';
  const name = document.createElement('div');
  name.style.cssText = 'font-weight: 600; font-size: 0.75rem;';
  name.textContent = row.venueName ? `${row.venueName} · ${row.courtName}` : row.courtName;
  const times = document.createElement('div');
  times.style.cssText = 'font-size: 0.6875rem; color: var(--tmx-text-muted); font-variant-numeric: tabular-nums;';
  times.textContent = `${row.currentStart}–${row.currentEnd}`;
  label.appendChild(name);
  label.appendChild(times);
  wrap.appendChild(label);

  // 24h window bar — a thin rule with a coloured segment showing the open
  // window. Updates live as the time inputs change so the operator gets a
  // visual sense of how long the court is open before committing.
  const bar = document.createElement('div');
  bar.style.cssText =
    'position: relative; height: 6px; background: var(--tmx-bg-secondary, rgba(128,128,128,0.12)); border-radius: 3px;';
  const window = document.createElement('div');
  window.style.cssText =
    'position: absolute; top: 0; bottom: 0; background: var(--tmx-fill-accent, #2563eb); border-radius: 3px;';
  bar.appendChild(window);
  row.windowBar = window;
  applyWindowStyle(window, row.currentStart, row.currentEnd);
  wrap.appendChild(bar);

  // Time inputs
  const inputs = document.createElement('div');
  inputs.style.cssText = 'display: flex; align-items: center; gap: 6px;';
  const startInput = makeTimeInput(row.currentStart);
  const endInput = makeTimeInput(row.currentEnd);
  row.startInput = startInput;
  row.endInput = endInput;

  const sep = document.createElement('span');
  sep.style.cssText = 'color: var(--tmx-text-muted); font-size: 0.6875rem;';
  sep.textContent = 'to';

  inputs.appendChild(startInput);
  inputs.appendChild(sep);
  inputs.appendChild(endInput);
  wrap.appendChild(inputs);

  const refresh = () => {
    row.currentStart = startInput.value || row.initialStart;
    row.currentEnd = endInput.value || row.initialEnd;
    times.textContent = `${row.currentStart}–${row.currentEnd}`;
    applyWindowStyle(window, row.currentStart, row.currentEnd);
  };
  startInput.addEventListener('input', refresh);
  endInput.addEventListener('input', refresh);

  return wrap;
}

function makeTimeInput(value: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'time';
  input.value = value;
  input.step = '900'; // 15 minutes — matches the engine's slotMinutes default
  input.style.cssText =
    'font-size: 0.75rem; padding: 2px 4px; border: 1px solid var(--tmx-border-primary); border-radius: 4px; background: var(--tmx-bg-primary); color: var(--tmx-color-primary); font-variant-numeric: tabular-nums;';
  return input;
}

function applyWindowStyle(windowEl: HTMLDivElement, startTime: string, endTime: string): void {
  const startMin = clamp(timeToMinutes(startTime), DAY_START_MIN, DAY_END_MIN);
  const endMin = clamp(timeToMinutes(endTime), DAY_START_MIN, DAY_END_MIN);
  if (endMin <= startMin) {
    // Empty window — hide the segment so the operator sees the problem.
    windowEl.style.left = '0%';
    windowEl.style.width = '0%';
    windowEl.style.background = 'var(--tmx-accent-red, #ef4444)';
    return;
  }
  const left = (startMin / DAY_END_MIN) * 100;
  const width = ((endMin - startMin) / DAY_END_MIN) * 100;
  windowEl.style.left = `${left}%`;
  windowEl.style.width = `${width}%`;
  windowEl.style.background = 'var(--tmx-fill-accent, #2563eb)';
}

function timeToMinutes(hhmm: string): number {
  if (typeof hhmm !== 'string') return 0;
  const [hStr, mStr] = hhmm.split(':');
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr ?? '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/**
 * For each row whose times changed, build a new `dateAvailability[]` that
 * preserves every existing entry (other dates + any bookings on the target
 * date) and updates only the target date's startTime/endTime — or appends a
 * new entry when none exists. Emit one MODIFY_COURT_AVAILABILITY per
 * changed court through the workspace queue.
 */
async function applyChanges(
  rows: CourtRow[],
  scheduledDate: string,
  tournamentRecord: any,
  onApplied?: () => void,
): Promise<void> {
  const methods: { method: string; params: any }[] = [];

  for (const row of rows) {
    if (row.currentStart === row.initialStart && row.currentEnd === row.initialEnd) continue;
    if (timeToMinutes(row.currentEnd) <= timeToMinutes(row.currentStart)) {
      tmxToast({
        message: `${row.courtName}: open time must be before close time`,
        intent: 'is-warning',
      });
      return;
    }
    const dateAvailability = buildUpdatedDateAvailability(row, scheduledDate);
    methods.push({ method: MODIFY_COURT_AVAILABILITY, params: { courtId: row.courtId, dateAvailability } });
  }

  if (!methods.length) {
    tmxToast({ message: 'No changes to apply', intent: 'is-info' });
    return;
  }

  executeMethods({
    mode: 'availability',
    methods,
    onRefresh: onApplied,
    onResult: (result) => {
      if (!result.success) return;
      // Update the row's "initial" baseline so a second Apply within the
      // same popover session doesn't re-send the original delta. We don't
      // close the popover automatically — operators often want to tweak
      // multiple courts in one pass.
      for (const row of rows) {
        row.initialStart = row.currentStart;
        row.initialEnd = row.currentEnd;
      }
    },
  });

  // We don't await — executeMethods is fire-and-forget. The toast inside
  // queueService handles success / failure user feedback consistently with
  // the Grid / Profile mutation paths.
  void tournamentRecord;
}

function buildUpdatedDateAvailability(row: CourtRow, scheduledDate: string): any[] {
  return updateCourtDateAvailability(row.court.dateAvailability, {
    date: scheduledDate,
    startTime: row.currentStart,
    endTime: row.currentEnd,
  });
}
