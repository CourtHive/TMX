import { venueCalendarDate, venueClock } from 'functions/venueTimeFrame';
import { t } from 'i18n';

// `scheduledDate` / `scheduledTime` are bare venue wall-clock values, so the
// "now" they are compared against must be the venue's clock too — otherwise a
// match reads as past or future purely because of where the laptop is.
function todayYmd(): string {
  return venueCalendarDate();
}

function nowHm(): string {
  return venueClock();
}

type Status = 'future' | 'past' | 'none';

function dateStatus(scheduledDate?: string): Status {
  if (!scheduledDate) return 'none';
  const today = todayYmd();
  if (scheduledDate < today) return 'past';
  return 'future';
}

function dateTimeStatus(scheduledDate?: string, scheduledTime?: string): Status {
  if (!scheduledDate && !scheduledTime) return 'none';
  if (!scheduledDate) return 'future';
  const today = todayYmd();
  if (scheduledDate < today) return 'past';
  if (scheduledDate > today) return 'future';
  if (!scheduledTime) return 'future';
  return scheduledTime < nowHm() ? 'past' : 'future';
}

function styleForStatus(status: Status): string {
  if (status === 'future') return 'color:var(--tmx-accent-green);font-weight:600;';
  if (status === 'past') return 'opacity:0.55;';
  return '';
}

export function scheduleDateFormatter(cell: any): HTMLSpanElement | string {
  const value = cell.getValue();
  if (!value) return '';
  const el = document.createElement('span');
  el.style.cssText = styleForStatus(dateStatus(value));
  el.textContent = value;
  return el;
}

export function scheduleTimeFormatter(cell: any): HTMLSpanElement | string {
  const value = cell.getValue();
  if (!value) return '';
  const data = cell.getRow().getData();
  const el = document.createElement('span');
  el.style.cssText = styleForStatus(dateTimeStatus(data?.scheduledDate, value));
  el.textContent = value;
  return el;
}

// A pinned placement. The cell value is the boolean the factory predicate
// returned, so an inert lock (completed matchUp, or nothing placed) renders
// empty rather than claiming a lock the engine would ignore. `lockReason` is
// the director's own note and rides in the tooltip when present.
export function scheduleLockFormatter(cell: any): HTMLSpanElement | string {
  if (!cell.getValue()) return '';
  const reason = cell.getRow().getData()?.lockReason;
  const el = document.createElement('span');
  el.className = 'fa-solid fa-lock';
  el.style.cssText = 'color: var(--tmx-accent-orange, #d97706); font-size: 0.75rem;';
  el.title = reason ? t('schedule.lockedWithReason', { reason }) : t('schedule.lockedTip');
  return el;
}

// `calledAt` is a full ISO **instant** (stamped when a matchUp is dropped on the
// active strip), unlike scheduledTime's bare HH:MM — so it needs a zone, and the
// zone is the venue's.
//
// This column is the one `matchUpStatusPredicates.isCalledForScheduledDay` names
// when it says "the same convention the calledAt column uses". #1362 moved that
// predicate and the Call Timing Variance report and missed the column itself,
// which left the page disagreeing with itself in the sharpest possible way: the
// row was bucketed as called-today on the venue's clock while the cell beside it
// printed the operator's.
export function calledAtFormatter(cell: any): HTMLSpanElement | string {
  const clock = venueClock(cell.getValue());
  if (!clock) return '';
  const el = document.createElement('span');
  el.textContent = clock;
  return el;
}
