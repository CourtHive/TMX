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
 * The complete profile, built at generation rather than at import.
 *
 * `mockProfiles` is a module-level constant, so anything clock-based written inline would be fixed
 * at page load, while `scenarioProfile.anchor: 'NOW'` is resolved by the factory when the
 * tournament is generated. Those drift apart in a tab left open — which is exactly how a demo is
 * run — and the maintenance window would sit where it was at load while the schedule moved.
 */
export function buildLiveScheduleProfile(now: Date = new Date()) {
  const scheduleDate = isoDate(now);

  // A court goes down shortly after NOW, long enough to overlap matchUps already placed on it.
  const blockStart = new Date(now.getTime() + 40 * 60_000);
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

    // The whole point: place the first matchUp well before now, so the day has matchUps behind the
    // current time, around it, and ahead of it. A schedule entirely in the future leaves the
    // now-strip, auto-call and due badges with nothing to act on.
    scenarioProfile: { anchor: 'NOW', minutesBeforeAnchor: MINUTES_BEFORE_ANCHOR, assignCourts: true },
  };
}

/** The catalogue entry. `build` is resolved at generation; see `buildLiveScheduleProfile`. */
export const LIVE_SCHEDULE_PROFILE = {
  tournamentName: LIVE_SCHEDULE_TOURNAMENT_NAME,
  build: buildLiveScheduleProfile,
};
