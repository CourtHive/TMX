/**
 * Schedule2 — Inspector rest section.
 *
 * Rest itself is the factory's `getParticipantRest` (scheduleGovernor). TMX carried its own copy of
 * the analysis, and the zone arithmetic it needed, until 2026-10-07; the factory does the instant
 * and venue-zone work now, so what is left here is the one decision the factory cannot make — what
 * "now" means for the day on screen — and the rendering.
 *
 * ── `asOf` is the PROJECTED instant, not the real one ──
 *
 * The factory holds no clock, so the caller supplies `asOf`. Passing the real `now` unconditionally
 * fails open: `resolveScheduleDate()` opens the schedule on a tournament's LAST date once its dates
 * are past, so anyone running a past-dated event in real time lives there permanently, and against
 * a real `now` three days later every anchor on that day sits hours in the past. Rest figures in the
 * thousands, everybody "rested" — the one direction this feature must never fail in.
 *
 * So `restAsOf` projects the venue's current time-of-day onto the day being measured, as
 * `venueNowOnDate()` does for the Now strip. The projection runs BACKWARDS only. Onto a future day
 * it would invent a clock: at 22:51 the evening before, every matchUp on tomorrow's card before
 * 22:51 would read as already under way, and a player badged "on court" in a tournament with no
 * courts — reported from production on BOBOCA `a4e439fa-…`. For a future day `asOf` is therefore
 * the real instant, which lies before that day's midnight, so every anchor on it is in the future
 * and the rows report `none`.
 *
 * ── The zone: the VENUE's, not the operator's ──
 *
 * Resolved once per evaluator pass through `resolveVenueFrame()` and handed to the factory as
 * `timeZone` — the convention the whole schedule surface shares
 * (`Mentat/planning/DECISION_VENUE_TIME_FRAME.md`).
 */

import { resolveVenueFrame, venueCalendarDate, venueClock, venueWallClockToMs } from 'functions/venueTimeFrame';
import { applyGridSearch, gridSearchAvailable } from './gridSearchControl';
import { getCachedAllMatchUps } from './schedule2DataCache';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { restRowActivation } from './restRowActivation';
import { locateMatchUp } from './locateMatchUp';
import { t } from 'i18n';

// constants and types
import type { RestResult, RestRow } from 'tods-competition-factory';
import type { ReadinessMatchUp } from './matchUpReadiness';

/** Rest is a minutes-granularity quantity; matches the Now strip's own cadence. */
const REFRESH_MS = 30_000;
const MS_PER_MINUTE = 60_000;

/**
 * The instant rest is measured "as of", for a matchUp measured on `restDate`. See the header note.
 *
 * Today or a past day: that day at the venue's current wall clock, seconds included (a whole-minute
 * offset cannot move them). A future day, a missing day, or a clock the venue frame cannot place:
 * the real instant.
 *
 * `now` is a parameter so a whole evaluator pass shares one reading of the clock, and so this stays
 * testable without mocking the global clock.
 */
export function restAsOf(restDate: string | null, timeZone?: string, now: Date = new Date()): string {
  const real = now.toISOString();
  if (!restDate) return real;
  const today = venueCalendarDate(now, timeZone);
  // `YYYY-MM-DD` orders lexicographically, so a string comparison is the calendar one.
  if (!today || restDate > today) return real;
  const projected = venueWallClockToMs(restDate, venueClock(now, timeZone), timeZone);
  if (projected === undefined) return real;
  return new Date(projected + (now.getTime() % MS_PER_MINUTE)).toISOString();
}

/**
 * The day a matchUp's rest should be measured on.
 *
 * A **scheduled** matchUp carries its own answer, and that answer cannot drift: it is a property of
 * the thing being inspected rather than a second variable that has to be kept in step with the page.
 * The ambient date is the fallback, for a catalog card that has not been scheduled yet and genuinely
 * has no day of its own.
 *
 * This ordering exists because the two disagreed in production: the Inspector took its date from a
 * store `selectedDate` that was never synced, while the card badge on the same matchUp took
 * gridView's `currentDate` and was correct — two surfaces, two days, and rest that read "cannot be
 * measured" beside a badge reading "41m". Reading the date off the matchUp makes that class of bug
 * unrepresentable.
 */
export function restDateFor(matchUp: ReadinessMatchUp | undefined, viewedDate: string | null): string | null {
  return matchUp?.schedule?.scheduledDate ?? viewedDate;
}

/**
 * A rest evaluator valid for one pass, sharing the engine work across every matchUp it is asked
 * about.
 *
 * The hydrated matchUps are read once and handed to the factory, which would otherwise hydrate the
 * tournament again on every call — the catalog's badge ticker re-reads every visible card on a
 * timer. The clock and the venue frame are read once too, so every badge in a tick agrees about what
 * time it is.
 */
export function makeRestEvaluator(): (matchUpId: string, viewedDate: string | null) => RestResult {
  // `inContext` matchUps, straight from the cache: the factory types them as `HydratedMatchUp`,
  // and the local lookup below reads them through the narrower `ReadinessMatchUp` shape.
  const matchUps = getCachedAllMatchUps().matchUps ?? [];
  const byId = new Map((matchUps as ReadinessMatchUp[]).map((matchUp) => [matchUp.matchUpId, matchUp]));
  const { timeZone } = resolveVenueFrame();
  const now = new Date();

  return (matchUpId, viewedDate) => {
    const restDate = restDateFor(byId.get(matchUpId), viewedDate);
    const result: any = tournamentEngine.getParticipantRest({
      matchUpId,
      matchUps,
      asOf: restAsOf(restDate, timeZone, now),
      ...(restDate && { scheduledDate: restDate }),
      timeZone,
    });
    return result?.rest ?? { evaluated: false, reason: 'unknownMatchUp' };
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
  // Checked before the status bands: a pending row is banded `onCourt` because
  // rest has not begun, but nobody is on court under that name — the name is a
  // matchUp, and the sentence has to say so.
  if (row.pendingUpstream) {
    return row.readyAt
      ? t('schedule.inspector.rest.pendingUntil', { time: row.readyAt })
      : t('schedule.inspector.rest.pending');
  }
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
  // Nobody is known, so nothing can be counted — see `UNKNOWN_LOAD`. Printing
  // the zero would read as "match #0 today".
  if (row.pendingUpstream) return '';
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

/**
 * Make the row respond to a click, when there is somewhere for the click to land.
 *
 * Two gestures, one for each kind of row, each answering the question its own row
 * raises. A row for a person drives the court grid's search box, which highlights
 * every cell that player appears in on the viewed day — "when DID they play?"
 * answered without retyping a name. A row for an undecided side points at the
 * matchUp that decides it: its name is a matchUp label, so a name search would
 * highlight nothing while looking like it should, and the honest target is the
 * feeder the row was built from. `restRowActivation` holds that rule; this wires it.
 *
 * Offered only when the court grid is actually on screen — the plan and profile
 * views have none, and an affordance that silently does nothing is worse than no
 * affordance. `gridSearchAvailable()` is what knows: the search box is mounted with
 * the grid and its registration is dropped once the input detaches. It gates BOTH
 * activations, not only the search one.
 *
 * `dataset` rather than re-reading `.tmx-rest-name` text so the seed/ranking
 * suffixes a future display config might add cannot leak into the query — and, for
 * a pending row, so the feeder is named by id rather than by a label that has been
 * through `pendingName` interpolation.
 */
function attachActivation(element: HTMLElement, row: RestRow): void {
  const activation = restRowActivation(row, gridSearchAvailable());
  if (!activation) return;

  if (activation.kind === 'search') {
    element.dataset.participantName = activation.participantName;
    element.classList.add('is-searchable');
    element.setAttribute('aria-label', t('schedule.inspector.rest.searchFor', { name: activation.participantName }));
  } else {
    element.dataset.locateMatchUpId = activation.matchUpId;
    element.classList.add('is-locatable');
    // The row's own `participantName` — a pending row's is the feeder's label, the
    // same words the row prints — so what is announced names what the operator is
    // looking at rather than an opaque id.
    element.setAttribute('aria-label', t('schedule.inspector.rest.locateFeeder', { label: row.participantName }));
  }

  element.tabIndex = 0;
  element.setAttribute('role', 'button');
}

function buildRow(row: RestRow): HTMLElement {
  const element = document.createElement('div');
  element.className = `tmx-rest-row is-${row.status.toLowerCase()}`;
  element.dataset.status = row.status;
  if (row.pendingUpstream) element.dataset.pendingUpstream = 'true';
  element.dataset.participantId = row.participantId;

  attachActivation(element, row);

  const name = row.pendingUpstream
    ? t('schedule.inspector.rest.pendingName', { label: row.participantName })
    : row.participantName;
  element.appendChild(line(name, 'tmx-rest-name'));
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

/** Rows that respond to activation — either gesture. See `attachActivation`. */
const ACTIVATABLE_ROW = '.tmx-rest-row.is-searchable, .tmx-rest-row.is-locatable';

/**
 * Delegated so it survives `paint()` replacing every row on the 30-second tick —
 * bound once to the section, which outlives its children.
 */
function onSectionActivate(event: Event): void {
  const target = event.target as HTMLElement | null;
  const row = target?.closest?.(ACTIVATABLE_ROW) as HTMLElement | null;
  if (!row) return;
  // `event.type`, not `instanceof KeyboardEvent`: the constructor is realm-bound,
  // so an event crossing a frame boundary would fail the check and fall through
  // to activating on every keystroke.
  if (event.type === 'keydown') {
    const { key } = event as KeyboardEvent;
    if (key !== 'Enter' && key !== ' ') return;
    // Space scrolls the Inspector otherwise, which throws the row out from under
    // the operator at the moment they act on it.
    event.preventDefault();
  }

  const { locateMatchUpId, participantName } = row.dataset;
  // Exactly one of the two is ever set, so the order is not a precedence rule —
  // but the locate branch is read first because it is the one that can fail.
  if (locateMatchUpId) {
    // A feeder need not be drawn: it may be unscheduled, or scheduled on a day
    // the operator is not looking at. Say so rather than leaving a dead click —
    // the row looks identical either way, and silence reads as a broken feature.
    if (!locateMatchUp(locateMatchUpId)) {
      tmxToast({ message: t('schedule.inspector.rest.feederNotDrawn'), intent: 'is-info' });
    }
    return;
  }
  if (participantName) applyGridSearch(participantName);
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
// module-level interval drives every section currently mounted; each drops itself
// when its element leaves the document, which is what makes this safe against the
// Inspector rebuilding its body on every state change and against the schedule
// tab unmounting without telling us.

interface RestMount {
  section: HTMLElement;
  matchUpId: string;
  viewedDate: string | null;
}

let tickHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Every mounted section, not just the latest one.
 *
 * This was a single slot, which was correct while exactly one Rest section could
 * exist. It cannot be any more: the court grid's cell popover can open its own
 * Inspector view while the sidebar panel is showing another matchUp, and a
 * single slot would silently stop the older one — leaving a frozen rest figure
 * beside a live one, which is the precise failure this file's history is about.
 *
 * Pruned by connectedness on each tick, the same contract as before, so a
 * section discarded by a rebuild or a closed popover drops itself without anyone
 * having to remember to deregister it.
 */
const mounts = new Set<RestMount>();

function stopTicker(): void {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
  mounts.clear();
}

function tick(): void {
  for (const mount of [...mounts]) {
    if (!mount.section.isConnected) {
      mounts.delete(mount);
      continue;
    }
    paint(mount.section, mount.matchUpId, mount.viewedDate);
  }
  if (!mounts.size) stopTicker();
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
  section.addEventListener('click', onSectionActivate);
  section.addEventListener('keydown', onSectionActivate);
  paint(section, matchUpId, viewedDate);

  mounts.add({ section, matchUpId, viewedDate });
  tickHandle ??= setInterval(tick, REFRESH_MS);
  return section;
}
