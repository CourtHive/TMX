import { fixtures, policyConstants, drawDefinitionConstants } from 'tods-competition-factory';
import { competitionNow } from 'services/clock/competitionClock';
import {
  SCHEDULER_DEMO_ID,
  SCHEDULER_DEMO_NAME,
  SCHEDULER_DEMO_VENUE,
  SCHEDULER_DEMO_ZONE,
  SCHEDULER_DEMO_SCRIPT,
} from 'services/clock/schedulingDemoScript';

export {
  SCHEDULER_DEMO_ID,
  SCHEDULER_DEMO_NAME,
  SCHEDULER_DEMO_VENUE,
  SCHEDULER_DEMO_ZONE,
  SCHEDULER_DEMO_SCRIPT,
  hasSchedulingDemoScript,
} from 'services/clock/schedulingDemoScript';

/** Explicit calendar arithmetic: independent of the presenter's browser zone and DST. */
export function schedulerDemoDates(startDate: string): string[] {
  const start = Date.parse(`${startDate}T12:00:00Z`);
  return [0, 1, 2].map((day) => new Date(start + day * 86_400_000).toISOString().slice(0, 10));
}

/** Starts UNSCHEDULED so the audience sees each scheduler's actual output. */
export function buildSchedulerDemoProfile(now = competitionNow()) {
  if (Number.isNaN(now.getTime())) return undefined;
  const startDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHEDULER_DEMO_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const dates = schedulerDemoDates(startDate);
  const draws = [
    { id: 'garman', name: 'Garman Singles', type: 'SINGLES', size: 16, day: 0 },
    { id: 'pro', name: 'Pro Doubles', type: 'DOUBLES', size: 8, day: 1 },
    { id: 'hybrid-singles', name: 'Combined Singles', type: 'SINGLES', size: 16, day: 2 },
    { id: 'hybrid-doubles', name: 'Combined Doubles', type: 'DOUBLES', size: 8, day: 2 },
  ];
  return {
    tournamentName: SCHEDULER_DEMO_NAME,
    tournamentAttributes: {
      tournamentId: SCHEDULER_DEMO_ID,
      localTimeZone: SCHEDULER_DEMO_ZONE,
      extensions: [{ name: 'demoScript', value: SCHEDULER_DEMO_SCRIPT }],
    },
    startDate,
    endDate: dates[2],
    nonRandom: 1,
    participantsProfile: { scaledParticipantsCount: 64, idPrefix: 'scheduler-demo' },
    policyDefinitions: {
      [policyConstants.POLICY_TYPE_SCHEDULING]: {
        ...fixtures.policies.POLICY_SCHEDULING_DEFAULT[policyConstants.POLICY_TYPE_SCHEDULING],
        // Day three deliberately mixes two singles and two doubles rounds. The default total
        // cap of three would omit work before the audience can compare the two schedulers.
        defaultDailyLimits: {
          ...fixtures.policies.POLICY_SCHEDULING_DEFAULT[policyConstants.POLICY_TYPE_SCHEDULING].defaultDailyLimits,
          total: 4,
        },
      },
    },
    drawProfiles: draws.map((draw) => ({
      eventName: draw.name,
      eventId: `scheduler-event-${draw.id}`,
      drawId: `scheduler-draw-${draw.id}`,
      eventType: draw.type,
      drawType: drawDefinitionConstants.SINGLE_ELIMINATION,
      drawSize: draw.size,
    })),
    venueProfiles: [
      {
        venueId: SCHEDULER_DEMO_VENUE,
        venueName: 'Scheduling Lab',
        courtsCount: 4,
        startTime: '10:00',
        endTime: '23:00',
        courtTimings: [
          undefined,
          undefined,
          {
            bookings: [{ startTime: '12:00', endTime: '13:00', bookingType: 'MAINTENANCE' }],
          },
        ],
      },
    ],
    schedulingProfile: dates.map((scheduleDate, day) => ({
      scheduleDate,
      venues: [
        {
          venueId: SCHEDULER_DEMO_VENUE,
          rounds: draws
            .filter((draw) => draw.day === day)
            .flatMap((draw) => [1, 2].map((roundNumber) => ({ drawId: `scheduler-draw-${draw.id}`, roundNumber }))),
        },
      ],
    })),
    autoSchedule: false,
  };
}

export const SCHEDULER_DEMO_PROFILE = {
  tournamentName: SCHEDULER_DEMO_NAME,
  build: buildSchedulerDemoProfile,
};
