/**
 * The "Live Schedule" demo tournament.
 *
 * Every other example in `mockTournaments` generates draws and a venue and stops. Measured before
 * this existed: across the whole catalogue, ZERO matchUps carried a `schedule` — the schedule page
 * opened with courts and an empty grid, so the now-strip, auto-call, due badges, court-block runway
 * and recovery countdowns had nothing to act on. This is the example that gives them something.
 *
 * Kept in its own module, importing only the factory, so it can be generated and asserted in a test.
 * TMX has no DOM in vitest and `mockTournaments` reaches DOM-bound services, so a profile living
 * there is unreachable from a test — and an unverified demo fixture is how "it should schedule"
 * became "it schedules nothing" in the first place.
 */
import { policyConstants, drawDefinitionConstants, fixtures } from 'tods-competition-factory';

const { SINGLE_ELIMINATION } = drawDefinitionConstants;

/**
 * Recovery and average minutes are what make the schedule page's clocks mean anything — without
 * them the scheduler packs matchUps back to back and every recovery countdown reads zero. Taken
 * from the factory fixture rather than restated here; a hand-copied table drifts.
 */
const LIVE_SCHEDULE_POLICY = {
  [policyConstants.POLICY_TYPE_SCHEDULING]:
    fixtures.policies.POLICY_SCHEDULING_DEFAULT[policyConstants.POLICY_TYPE_SCHEDULING],
};

export const LIVE_VENUE_ID = 'venue-live-01';
export const LIVE_DRAW_MAIN = 'draw-live-main';
export const LIVE_DRAW_SECOND = 'draw-live-second';
export const LIVE_SCHEDULE_TOURNAMENT_NAME = 'Live Schedule';

/** Minutes before the anchor at which the day's FIRST matchUp is placed. */
export const MINUTES_BEFORE_ANCHOR = 150;

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * The earliest and latest hour the day can be ANCHORED to.
 *
 * The schedule runs five rounds in sequence from 150 minutes before the anchor, so the anchor
 * decides whether the whole day fits between the venue opening (06:00) and closing (23:00):
 *   - earlier than 09:00 and the first matchUp lands before the courts open — and near midnight the
 *     anchor runs BACKWARD past the tournament's own start date, which the factory refuses
 *     ("anchoring would move a matchUp to <yesterday>, outside the tournament's dates");
 *   - later than 16:00 and the tail runs past closing, and then past midnight, which it also
 *     refuses.
 *
 * Measured under `nonRandom` on 2026-09-24: generation succeeded at 07:00-16:00 and failed at 19:00
 * and 22:00, and at 00:30 in the other direction. Trimming rounds only moved the evening cliff from
 * 19:00 to 22:00 rather than removing it.
 *
 * So the example clamps: opened outside the band it still generates a full, believable day — the
 * demo simply shows a day already finished (late evening) or not yet started (small hours) rather
 * than failing to open at all. Inside the band, which is when anyone demonstrates anything, it
 * straddles the current time exactly as intended.
 */
export const ANCHOR_EARLIEST_HOUR = 9;
export const ANCHOR_LATEST_HOUR = 16;

function clampAnchor(now: Date): Date {
  const clamped = new Date(now);
  if (now.getHours() < ANCHOR_EARLIEST_HOUR) clamped.setHours(ANCHOR_EARLIEST_HOUR, 0, 0, 0);
  else if (now.getHours() >= ANCHOR_LATEST_HOUR) clamped.setHours(ANCHOR_LATEST_HOUR, 0, 0, 0);
  return clamped;
}

/**
 * The complete profile, built at generation rather than at import.
 *
 * `mockProfiles` is a module-level constant, so anything clock-based written inline would be fixed
 * at page load, while `scenarioProfile.anchor: 'NOW'` is resolved by the factory when the
 * tournament is generated. Those drift apart in a tab left open — which is exactly how a demo is
 * run — and the maintenance window would sit where it was at load while the schedule moved.
 */
export function buildLiveScheduleProfile(now: Date = new Date()) {
  const scheduleDate = isoDate(now);
  const anchor = clampAnchor(now);

  // A court goes down shortly after the ANCHOR, long enough to overlap matchUps already placed on
  // it. Measured from the anchor rather than from `now`, and that is the whole fix: the schedule
  // sits against the anchor, so outside the clamp band `now` is not where the day is.
  //
  // `hhmm()` has no notion of a date, so a base instant late enough formatted an `endTime` past
  // midnight as `00:xx` — earlier than its own `startTime`. Two failures came out of that, and the
  // loud one is not the bigger one:
  //   - 22:05-23:19: `endTime` wrapped but `startTime` had not, so the window ran BACKWARDS and the
  //     factory refused the whole generation with ERR_INVALID_DATE. The example could not open at
  //     all, and TMX CI could not go green, for those ~75 minutes a day;
  //   - 00:00-05:15 and 21:15-23:45: the window lay outside the venue's own 06:00-23:00 — silently.
  //     Generation succeeded and the maintenance block sat where no court was open, or on the
  //     following day. 28 of 96 quarter hours, measured by the sweep in the test file.
  //
  // The anchor is clamped to ANCHOR_LATEST_HOUR at the latest, so the window now ends by 17:55 and
  // is always inside venue hours. Inside the demonstrating band the anchor IS `now`, so nothing
  // changes for the hours anyone actually runs the demo in — pinned at 14:00 by the test.
  const blockStart = new Date(anchor.getTime() + 40 * 60_000);
  const blockEnd = new Date(blockStart.getTime() + 75 * 60_000);

  return {
    tournamentAttributes: { tournamentId: 'tournament-id-live-01' },
    participantsProfile: { scaledParticipantsCount: 64, idPrefix: 'lv' },
    tournamentName: LIVE_SCHEDULE_TOURNAMENT_NAME,
    policyDefinitions: LIVE_SCHEDULE_POLICY,
    startDate: scheduleDate,
    endDate: scheduleDate,

    drawProfiles: [
      {
        eventName: 'Open Singles',
        drawType: SINGLE_ELIMINATION,
        eventId: 'event-live-main',
        drawId: LIVE_DRAW_MAIN,
        // Not every matchUp: a day with everything scored has nothing still to come, and the
        // now-strip is about what happens next.
        completionGoal: 6,
        seedsCount: 8,
        drawSize: 32,
      },
      {
        eventName: 'Open Doubles',
        drawType: SINGLE_ELIMINATION,
        eventId: 'event-live-second',
        drawId: LIVE_DRAW_SECOND,
        eventType: 'DOUBLES',
        completionGoal: 4,
        seedsCount: 4,
        drawSize: 16,
      },
    ],

    venueProfiles: [
      {
        venueId: LIVE_VENUE_ID,
        venueName: 'Centre Club',
        venueAbbreviation: 'CEN',
        // Wide hours deliberately: the schedule is shifted to straddle the current time, and narrow
        // venue hours would put matchUps outside court availability in an early or late demo.
        startTime: '06:00',
        endTime: '23:00',
        courtsCount: 8,
        // Per-court, indexed by position — only Court 3 is blocked. A venue-wide `dateAvailability`
        // booking would close every court and leave nothing to reschedule onto.
        courtTimings: [
          undefined,
          undefined,
          { bookings: [{ startTime: hhmm(blockStart), endTime: hhmm(blockEnd), bookingType: 'MAINTENANCE' }] },
        ],
      },
    ],

    schedulingProfile: [
      {
        scheduleDate,
        venues: [
          {
            venueId: LIVE_VENUE_ID,
            rounds: [
              { drawId: LIVE_DRAW_MAIN, roundNumber: 1 },
              { drawId: LIVE_DRAW_SECOND, roundNumber: 1 },
              { drawId: LIVE_DRAW_MAIN, roundNumber: 2 },
              { drawId: LIVE_DRAW_SECOND, roundNumber: 2 },
              { drawId: LIVE_DRAW_MAIN, roundNumber: 3 },
            ],
          },
        ],
      },
    ],
    autoSchedule: true,

    // Deterministic layout. The draw shape decides how long the day's schedule runs, so with random
    // data the anchored span varied run to run and the example failed roughly one generation in
    // five at midday — a demo that sometimes does not open, and a test that was a dice roll.
    nonRandom: 1,

    // The whole point: place the first matchUp well before now, so the day has matchUps behind the
    // current time, around it, and ahead of it. A schedule entirely in the future leaves the
    // now-strip, auto-call and due badges with nothing to act on.
    scenarioProfile: {
      // An explicit instant, not `'NOW'`. Two reasons, and the second is the bug:
      //   - `'NOW'` reads the FACTORY's clock, so the profile's own `now` argument did not
      //     determine the output and a test could only reach it through fake timers;
      //   - unclamped, the anchor put the schedule where it could not fit (see `clampAnchor`).
      anchor: anchor.toISOString(),
      minutesBeforeAnchor: MINUTES_BEFORE_ANCHOR,
      assignCourts: true,
    },
  };
}

/** The catalogue entry. `build` is resolved at generation; see `buildLiveScheduleProfile`. */
export const LIVE_SCHEDULE_PROFILE = {
  tournamentName: LIVE_SCHEDULE_TOURNAMENT_NAME,
  build: buildLiveScheduleProfile,
};
