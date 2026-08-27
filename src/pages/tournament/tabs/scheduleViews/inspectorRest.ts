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
 * ── The frame every value ends up in: the VIEWED DAY'S wall clock ──
 *
 * `nowDayMinutes()` projects today's time-of-day onto whichever day is on
 * screen, and the three wall-clock fields are already read against that day. So
 * the instants have to land in the same frame, and `toDayMinutesFromInstant`
 * puts them there: local time-of-day, plus a full day for a genuine midnight
 * crossing, and NOT the raw elapsed interval from the viewed day's midnight.
 *
 * The distinction is invisible while the viewed day is the operator's own
 * calendar today, and decisive the moment it isn't — which is not an exotic
 * case. `resolveScheduleDate()` opens the schedule on the tournament's LAST
 * date once all of its dates are past, so anyone operating a past-dated
 * tournament in real time is in it permanently. Under the elapsed-interval
 * reading a score entered minutes ago normalized to `+1440·n` and therefore sat
 * in the "future" against a projected now, which `latestAnchor` can only report
 * as unmeasurable: the whole rest feature went dark, on every row, for exactly
 * the operator who is running matches right now.
 *
 * ── The zone: the VENUE's, not the operator's ──
 *
 * Every instant here is read in the tournament's own zone, resolved through
 * `resolveVenueFrame()` — the convention the whole schedule surface moved to
 * together, recorded in `Mentat/planning/DECISION_VENUE_TIME_FRAME.md`. It used
 * to be the browser's, which read every figure on this page off by the offset
 * between the operator's laptop and the venue, silently and plausibly.
 *
 * The frame is captured **once** per evaluator pass, alongside `asOfMinutes` and
 * for the same reason: every badge in a tick must agree about what time it is,
 * and re-resolving per row would let them disagree.
 *
 * The pure functions take the zone as a trailing argument rather than reaching
 * for it, so they stay testable without an engine — and so this file's one
 * impure half remains the only thing that decides what "now" and "where" mean.
 */

import { resolveVenueFrame, venueCalendarDate, venueDayMinutes } from 'functions/venueTimeFrame';
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
 * An instant → its LOCAL calendar date, `YYYY-MM-DD`. Deliberately not
 * `toISOString().slice(0, 10)`, which reports the UTC day and so names the wrong
 * date for every evening stamp west of Greenwich and every early-morning one
 * east of it. This is what dates a matchUp that carries no `scheduledDate`.
 */
export function instantLocalDate(iso?: string, timeZone?: string): string | undefined {
  if (!iso) return undefined;
  return venueCalendarDate(iso, timeZone) || undefined;
}

/** Whole calendar days from `fromDate` to `toDate`. Both parsed as UTC, so no DST transition can shorten a day. */
function dayDelta(fromDate: string, toDate: string): number | undefined {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return undefined;
  return Math.round((to - from) / 86_400_000);
}

/**
 * A UTC ISO instant → minutes on the **viewed day's wall clock**.
 *
 * Local time-of-day, offset by a whole day when the stamp genuinely crossed
 * midnight relative to the viewed day — so a match that finished at 00:40 the
 * following morning still reads as `1480` and orders after one that finished at
 * 23:50, which is the single reason the offset exists at all.
 *
 * The offset is applied for a **±1 day gap only**, and that limit is the
 * load-bearing part.
 * A stamp further away than that is not a midnight crossing; it is a score
 * entered on a different calendar date from the day it is filed under — a late
 * entry, or an operator running a past-dated tournament in real time. Its
 * elapsed distance from the viewed midnight says nothing about how long a player
 * has been off court, while its time-of-day says exactly that, read against the
 * same projected clock `nowDayMinutes()` supplies. Carrying the full `n·1440`
 * instead parked the anchor in the future and cost the row its rest figure
 * entirely.
 *
 * Reading time-of-day can only ever place an anchor LATER in the day than the
 * true finish (a score filed hours after the match), which understates rest and
 * so holds a player back — the direction this module is required to fail in.
 *
 * Day membership is not this function's job precisely because of that limit:
 * `instantLocalDate` answers it, exactly and without arithmetic.
 */
export function toDayMinutesFromInstant(
  iso?: string,
  viewedDate?: string | null,
  timeZone?: string,
): number | undefined {
  if (!iso || !viewedDate) return undefined;

  const timeOfDay = venueDayMinutes(iso, timeZone);
  if (timeOfDay === undefined) return undefined;

  const localDate = instantLocalDate(iso, timeZone);
  const delta = localDate === undefined ? undefined : dayDelta(viewedDate, localDate);
  if (delta === undefined) return undefined;

  const crossedMidnight = Math.abs(delta) === 1;
  return timeOfDay + (crossedMidnight ? MINUTES_PER_DAY * delta : 0);
}

/** Every time on a matchUp, normalized into minutes from local midnight of the day being viewed. */
export function normalizeTimes(
  matchUp: ReadinessMatchUp,
  viewedDate: string | null,
  timeZone?: string,
): NormalizedTimes {
  const schedule = matchUp.schedule ?? {};
  // END_DATE is written only when the match crossed midnight, so its presence
  // is exactly the signal that the bare endTime belongs to the following day.
  const endDayOffset = schedule.endDate && schedule.endDate !== schedule.scheduledDate ? MINUTES_PER_DAY : 0;
  const endMinutes = toDayMinutesFromClock(schedule.endTime);

  return {
    ...(endMinutes !== undefined && { endMinutes: endMinutes + endDayOffset }),
    scoredMinutes: toDayMinutesFromInstant(schedule.scoredTime, viewedDate, timeZone),
    scoredDate: instantLocalDate(schedule.scoredTime, timeZone),
    startMinutes: toDayMinutesFromClock(schedule.startTime),
    calledMinutes: toDayMinutesFromInstant(schedule.calledAt, viewedDate, timeZone),
    scheduledMinutes: toDayMinutesFromClock(schedule.scheduledTime),
  };
}

/**
 * "Now" as minutes from midnight of the viewed day. When the operator is looking
 * at another date, today's time-of-day is projected onto it — the same thing
 * `venueNowOnDate()` does for the Now strip, so the two agree — both in the
 * venue's zone.
 */
export function nowDayMinutes(timeZone?: string): number {
  return venueDayMinutes(new Date(), timeZone) ?? 0;
}

/** Tournament daily limits, or undefined when no scheduling policy is attached — never a substituted default. */
function readDailyLimits(): RestDailyLimits | undefined {
  const result: any = competitionEngine.getMatchUpDailyLimits();
  if (result?.error) return undefined;
  return result?.matchUpDailyLimits;
}

/**
 * The day a matchUp's rest should be measured on.
 *
 * A **scheduled** matchUp carries its own answer, and that answer cannot drift:
 * it is a property of the thing being inspected rather than a second variable
 * that has to be kept in step with the page. The ambient date is the fallback,
 * for a catalog card that has not been scheduled yet and genuinely has no day of
 * its own.
 *
 * This ordering exists because the two disagreed in production. The Inspector
 * took its date from the schedule-page store's `selectedDate`, which seeded from
 * the tournament's FIRST date and was never synced — TMX drives the date itself
 * and collapses the component's date strip, so nothing ever wrote to it. The card
 * badge, on the same matchUp, took gridView's `currentDate` and was correct. One
 * final, two surfaces, two different days, and rest that read "cannot be
 * measured" beside a badge reading "41m". The store is fixed (courthive-components
 * 3.15.1), but a fix that only synchronises two variables leaves the next
 * consumer free to desynchronise them again. Reading the date off the matchUp
 * makes that class of bug unrepresentable.
 */
export function restDateFor(matchUp: ReadinessMatchUp | undefined, viewedDate: string | null): string | null {
  return matchUp?.schedule?.scheduledDate ?? viewedDate;
}

/**
 * A rest evaluator valid for one pass, sharing the engine work across every
 * matchUp it is asked about.
 *
 * `makeTimingResolver()` walks the tournament's events and
 * `getMatchUpDailyLimits()` reaches the engine. Paying for both once is fine for
 * the Inspector's single matchUp and wrong for the catalog, where the badge
 * ticker re-reads every visible card on a timer — that is N engine passes every
 * 30 seconds for a screen that has not changed.
 *
 * `asOfMinutes` is captured once too, so every badge in a tick agrees about what
 * time it is. Reading the clock per badge would let a pass that straddles a
 * minute boundary render two cards a minute apart.
 */
export function makeRestEvaluator(): (matchUpId: string, viewedDate: string | null) => RestResult {
  const { matchUps } = getCachedAllMatchUps();
  const hydrated = (matchUps ?? []) as ReadinessMatchUp[];
  const timingFor = makeTimingResolver();
  const dailyLimits = readDailyLimits();
  // One frame for the whole pass — see the header note on why this is captured
  // here rather than read per row.
  const { timeZone } = resolveVenueFrame();
  const asOfMinutes = nowDayMinutes(timeZone);

  return (matchUpId, viewedDate) => {
    const restDate = restDateFor(
      hydrated.find((matchUp) => matchUp.matchUpId === matchUpId),
      viewedDate,
    );
    return analyzeParticipantRest({
      matchUpId,
      matchUps: hydrated,
      scheduledDate: restDate ?? '',
      asOfMinutes,
      timesFor: (matchUp) => normalizeTimes(matchUp, restDate, timeZone),
      dailyLimits,
      timingFor,
    });
  };
}

/**
 * The evaluator for the pass currently in progress, released as soon as the task
 * that built it finishes.
 *
 * `makeRestEvaluator` is documented as being worth building once per pass, and the
 * badge ticker duly builds one and reuses it across every card. The render did
 * not: `renderRestBadge` is `renderCardExtra`, called once per card, and it reached
 * `evaluateRest`, which built a whole evaluator per call. On a 149-matchUp
 * tournament that was 149 event-map walks, 149 daily-limit reads and 149
 * venue-frame resolutions — measured at 307 `getTournament` calls and ~235ms of a
 * ~300ms schedule render, for work whose answer is identical every time.
 *
 * A microtask is the release boundary because it is the tightest one that still
 * covers a whole synchronous render: every card drawn in one pass shares the
 * evaluator, and nothing survives into the next task, so no caller can read state
 * that a mutation has since replaced. It also gives the render the property the
 * ticker already has deliberately — every badge in a pass agrees about what time
 * it is, rather than a pass straddling a minute boundary and rendering two cards a
 * minute apart.
 */
let passEvaluator: ReturnType<typeof makeRestEvaluator> | null = null;

function evaluatorForPass(): ReturnType<typeof makeRestEvaluator> {
  if (!passEvaluator) {
    passEvaluator = makeRestEvaluator();
    queueMicrotask(() => {
      passEvaluator = null;
    });
  }
  return passEvaluator;
}

/** Rest for one matchUp, resolved against current factory state and the current clock. */
export function evaluateRest(matchUpId: string, viewedDate: string | null): RestResult {
  return evaluatorForPass()(matchUpId, viewedDate);
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
    if (row.overrun) return t('schedule.inspector.rest.onCourtOverrun');
    return row.readyAt
      ? t('schedule.inspector.rest.onCourtUntil', { time: row.readyAt })
      : t('schedule.inspector.rest.onCourt');
  }
  // No interval can be measured from an anchor in the future, so say that rather
  // than printing the zero the arithmetic produced.
  if (row.anchorUnreliable) return t('schedule.inspector.rest.anchorUnreliable');
  const rested = formatDuration(row.restMinutes ?? 0);
  const required = formatDuration(row.requiredMinutes);
  if (row.status === 'rested') return t('schedule.inspector.rest.rested', { rested, required });
  return t('schedule.inspector.rest.resting', { rested, required, time: row.readyAt ?? '' });
}

/**
 * The rungs the ladder could not read, as a sentence fragment. Empty when nothing
 * was skipped, which is the ordinary case.
 *
 * Named plainly rather than through the `source.*` labels: those read "from score
 * entry (est.)", which is a provenance claim and reads as nonsense inside a
 * sentence about what was rejected.
 */
export function describeDiscarded(row: RestRow): string {
  if (!row.discardedSources?.length) return '';
  const names = row.discardedSources.map((source) => t(`schedule.inspector.rest.discardedName.${source}`));
  // `rungs`, not `sources`: attr-audit reads a key one letter from `source` as a
  // likely typo, and the ladder's own word for these is the clearer one anyway.
  return t('schedule.inspector.rest.discarded', { rungs: names.join(', ') });
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
  // A rung the ladder threw out is a fault in the record, not a detail of the
  // estimate: a score filed the next day, or a day being asked about that the
  // stamp does not belong to. Falling through silently would leave the row
  // reading as a clean projection with the contradiction still sitting in the
  // data, which is the failure this whole change exists to stop repeating.
  if (row.discardedSources?.length) {
    element.dataset.discardedSources = row.discardedSources.join(',');
    element.appendChild(line(describeDiscarded(row), 'tmx-rest-discarded'));
  }
  // A row whose anchor was inferred rather than recorded must say so structurally,
  // not only in prose, so the distinction survives styling and screen readers.
  if (row.source && row.source !== 'endTime') element.dataset.estimated = 'true';
  if (row.anchorUnreliable) element.dataset.anchorUnreliable = 'true';
  if (row.overrun) element.dataset.overrun = 'true';
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
