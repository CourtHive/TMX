/**
 * Schedule2 — Inspector rest section.
 *
 * The impure half of the rest feature: reads the clock, converts every stored
 * time into one frame, pulls timing and daily limits from the engine, and
 * renders the result. All rules live in the pure `participantRest.ts`; this file
 * decides nothing except what "now" means.
 *
 * ── The single time-conversion site ──
 *
 * `toDayMinutes*` below is the ONLY place in the rest feature where a stored
 * value is interpreted as an instant or a wall clock. That concentration is
 * deliberate: the planned Temporal-spec standardization has one function to
 * replace rather than a scatter of `new Date()` calls.
 *
 * Two frames arrive from the factory and must not be confused:
 *
 *   - `endTime` / `startTime` / `scheduledTime` — bare military `HH:MM` (or an
 *     ISO string whose time portion is a naive wall clock; the factory's
 *     `extractTime` slices it rather than converting, and so do we);
 *   - `calledAt` / `scoredTime` — full UTC ISO **instants**, which must be
 *     converted to local wall clock before they can be compared with the above.
 *
 * Treating `scoredTime` as a wall clock — or `endTime` as an instant — produces
 * a rest figure wrong by the UTC offset, which is worse than showing nothing.
 *
 * **Assumption, stated rather than assumed:** browser-local time is venue-local
 * time. This is the convention every other schedule2 surface already uses
 * (`todayIso()`, `effectiveNowOnStripDate()`, the reports tab's `calledAtIso`
 * recomputation), and a page that mixed conventions would be the real hazard.
 * `tournamentRecord.localTimeZone` exists and is the known input for making this
 * explicit later; it is deliberately not consulted yet, so that the whole
 * surface moves in one step rather than half of it.
 */

import { makeTimingResolver } from './scheduleTimingResolver';
import { getCachedAllMatchUps } from './schedule2DataCache';
import { competitionEngine } from 'services/factory/engine';
import { analyzeParticipantRest } from './participantRest';
import { t } from 'i18n';

// constants and types
import type { NormalizedTimes, RestDailyLimits, RestRow, RestResult } from './participantRest';
import type { ReadinessMatchUp } from './matchUpReadiness';

const MINUTES_PER_DAY = 1440;
/** Rest is a minutes-granularity quantity; matches the Now strip's own cadence. */
const REFRESH_MS = 30_000;

/** `'14:20'` → `860`. Accepts an ISO string by slicing its naive wall-clock portion, as the factory does. */
export function toDayMinutesFromClock(value?: string): number | undefined {
  if (!value) return undefined;
  const clock = value.includes('T') ? value.split('T').at(-1) : value;
  const matched = /^(\d{1,2}):(\d{2})/.exec((clock ?? '').trim());
  if (!matched) return undefined;
  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/**
 * A UTC ISO instant → minutes from local midnight of `viewedDate`. A stamp from
 * a different calendar day lands outside `0..1439`, which is what the rest
 * arithmetic needs in order to say "ended yesterday" rather than silently
 * wrapping.
 */
export function toDayMinutesFromInstant(iso?: string, viewedDate?: string | null): number | undefined {
  if (!iso || !viewedDate) return undefined;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return undefined;

  const midnight = new Date(`${viewedDate}T00:00:00`);
  if (Number.isNaN(midnight.getTime())) return undefined;

  return Math.round((instant.getTime() - midnight.getTime()) / 60_000);
}

/** Every time on a matchUp, normalized into minutes from local midnight of the day being viewed. */
export function normalizeTimes(matchUp: ReadinessMatchUp, viewedDate: string | null): NormalizedTimes {
  const schedule = matchUp.schedule ?? {};
  // END_DATE is written only when the match crossed midnight, so its presence
  // is exactly the signal that the bare endTime belongs to the following day.
  const endDayOffset = schedule.endDate && schedule.endDate !== schedule.scheduledDate ? MINUTES_PER_DAY : 0;
  const endMinutes = toDayMinutesFromClock(schedule.endTime);

  return {
    ...(endMinutes !== undefined && { endMinutes: endMinutes + endDayOffset }),
    scoredMinutes: toDayMinutesFromInstant(schedule.scoredTime, viewedDate),
    startMinutes: toDayMinutesFromClock(schedule.startTime),
    calledMinutes: toDayMinutesFromInstant(schedule.calledAt, viewedDate),
    scheduledMinutes: toDayMinutesFromClock(schedule.scheduledTime),
  };
}

/**
 * "Now" as minutes from midnight of the viewed day. When the operator is looking
 * at another date, today's time-of-day is projected onto it — the same thing
 * `effectiveNowOnStripDate()` does for the Now strip, so the two agree.
 */
export function nowDayMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Tournament daily limits, or undefined when no scheduling policy is attached — never a substituted default. */
function readDailyLimits(): RestDailyLimits | undefined {
  const result: any = competitionEngine.getMatchUpDailyLimits();
  if (result?.error) return undefined;
  return result?.matchUpDailyLimits;
}

/** Rest for one matchUp, resolved against current factory state and the current clock. */
export function evaluateRest(matchUpId: string, viewedDate: string | null): RestResult {
  const { matchUps } = getCachedAllMatchUps();
  const timingFor = makeTimingResolver();
  return analyzeParticipantRest({
    matchUpId,
    matchUps: (matchUps ?? []) as ReadinessMatchUp[],
    scheduledDate: viewedDate ?? '',
    asOfMinutes: nowDayMinutes(),
    timesFor: (matchUp) => normalizeTimes(matchUp, viewedDate),
    dailyLimits: readDailyLimits(),
    timingFor,
  });
}

/** `134` → `'2h 14m'`; under an hour drops the hours part entirely. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return t('schedule.inspector.rest.minutesOnly', { minutes: remainder });
  return t('schedule.inspector.rest.hoursMinutes', { hours, minutes: remainder });
}

/** The provenance suffix for a row — which rung of the ladder produced its anchor. */
export function describeSource(row: RestRow): string {
  if (!row.source) return '';
  return t(`schedule.inspector.rest.source.${row.source}`);
}

/** The rest figure itself, as a sentence fragment. */
export function describeRest(row: RestRow): string {
  if (row.status === 'none') return t('schedule.inspector.rest.noPriorMatch');
  if (row.status === 'onCourt') {
    return row.readyAt
      ? t('schedule.inspector.rest.onCourtUntil', { time: row.readyAt })
      : t('schedule.inspector.rest.onCourt');
  }
  const rested = formatDuration(row.restMinutes ?? 0);
  const required = formatDuration(row.requiredMinutes);
  if (row.status === 'rested') return t('schedule.inspector.rest.rested', { rested, required });
  return t('schedule.inspector.rest.resting', { rested, required, time: row.readyAt ?? '' });
}

/** The daily-load fragment: "3rd match today, limit 3". */
export function describeLoad(row: RestRow): string {
  const { ordinal, limit } = row.load;
  return limit === undefined
    ? t('schedule.inspector.rest.ordinal', { ordinal })
    : t('schedule.inspector.rest.ordinalLimit', { ordinal, limit });
}

function line(text: string, className: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text;
  return element;
}

function buildRow(row: RestRow): HTMLElement {
  const element = document.createElement('div');
  element.className = `tmx-rest-row is-${row.status.toLowerCase()}`;
  element.dataset.status = row.status;
  element.dataset.participantId = row.participantId;

  element.appendChild(line(row.participantName, 'tmx-rest-name'));
  element.appendChild(line(describeRest(row), 'tmx-rest-figure'));

  const detail = document.createElement('div');
  detail.className = 'tmx-rest-detail';
  const parts = [describeLoad(row), row.typeChange ? t('schedule.inspector.rest.typeChange') : '', describeSource(row)];
  detail.textContent = parts.filter(Boolean).join(' · ');
  element.appendChild(detail);

  if (row.load.atLimit.length) {
    element.dataset.atLimit = row.load.atLimit.join(',');
    element.appendChild(line(t('schedule.inspector.rest.atLimit'), 'tmx-rest-limit'));
  }
  // A row whose anchor was inferred rather than recorded must say so structurally,
  // not only in prose, so the distinction survives styling and screen readers.
  if (row.source && row.source !== 'endTime') element.dataset.estimated = 'true';
  if (row.fromMatchUpLabel) element.title = row.fromMatchUpLabel;
  return element;
}

function skipMessage(reason: string): string {
  const key = `schedule.inspector.rest.skip.${reason}`;
  const message = t(key);
  // `t()` echoes the key when it resolves to nothing; fall back to the generic
  // line rather than printing a dotted path at the operator.
  return message === key ? t('schedule.inspector.rest.skip.generic') : message;
}

/** Fill a section element with the current rest picture. Called on first render and on every tick. */
function paint(section: HTMLElement, matchUpId: string, viewedDate: string | null): void {
  section.replaceChildren();
  const result = evaluateRest(matchUpId, viewedDate);

  section.dataset.rest = result.evaluated ? String(result.rows.length) : 'skipped';
  section.appendChild(line(t('schedule.inspector.rest.heading'), 'tmx-rest-heading'));

  if (!result.evaluated) {
    section.appendChild(line(skipMessage(result.reason), 'tmx-rest-skip'));
    return;
  }

  for (const row of result.rows) section.appendChild(buildRow(row));
}

// ── Live refresh ──────────────────────────────────────────────────────────
// Rest counts up, so a static render goes stale the moment it is drawn. One
// module-level interval drives whichever section is currently mounted; it stops
// itself when that element leaves the document, which is what makes this safe
// against the Inspector rebuilding its body on every state change and against
// the schedule tab unmounting without telling us.

let tickHandle: ReturnType<typeof setInterval> | null = null;
let mounted: { section: HTMLElement; matchUpId: string; viewedDate: string | null } | null = null;

function stopTicker(): void {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
  mounted = null;
}

function tick(): void {
  if (!mounted?.section.isConnected) {
    stopTicker();
    return;
  }
  paint(mounted.section, mounted.matchUpId, mounted.viewedDate);
}

/**
 * The rest section for one matchUp. Returns a fresh element per call — the
 * Inspector rebuilds its body on every state change, so a cached node would be
 * re-parented rather than reused.
 */
export function renderRestSection(matchUpId: string, viewedDate: string | null): HTMLElement | null {
  if (!matchUpId) return null;

  const section = document.createElement('div');
  section.className = 'tmx-rest';
  paint(section, matchUpId, viewedDate);

  mounted = { section, matchUpId, viewedDate };
  tickHandle ??= setInterval(tick, REFRESH_MS);
  return section;
}
