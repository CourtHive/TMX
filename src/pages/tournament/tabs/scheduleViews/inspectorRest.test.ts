import { describeDiscarded, describeRest, restAsOf, restDateFor } from './inspectorRest';
import { scheduleGovernor } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

// constants and types
import type { ReadinessMatchUp } from './matchUpReadiness';
import type { RestRow } from 'tods-competition-factory';

const DATE = '2026-08-22';
const ZONE = 'America/New_York';
const REPORT_EVENING = '2026-09-11';
const PAST_DAY = '2026-09-08';
const EVENING_CLOCK = '22:51';

/**
 * Rest itself is the factory's query; what TMX decides is `asOf`. These run the two together,
 * `restAsOf` feeding `getParticipantRest`, because the defects they pin lived in the frame the
 * caller handed over, never in the analysis on its own. Every instant here is built in a NAMED
 * venue zone, so the assertions hold in any runner zone.
 */
const venueInstant = (date: string, clock: string, offset = '-04:00') => new Date(`${date}T${clock}:00${offset}`);

function restFor(matchUps: ReadinessMatchUp[], matchUpId: string, asOf: string, scheduledDate: string) {
  const result: any = scheduleGovernor.getParticipantRest({
    tournamentRecord: { tournamentId: 'rest-adapter', localTimeZone: ZONE } as any,
    matchUps: matchUps as any,
    matchUpId,
    asOf,
    scheduledDate,
    timeZone: ZONE,
  });
  if (!result.rest?.evaluated) throw new Error(`expected evaluation, got ${JSON.stringify(result)}`);
  return result.rest;
}

describe('restAsOf — the projection runs backwards in time, never forwards', () => {
  /** 22:51 at the venue on 2026-09-11 — the evening the production report came from. */
  const EVENING = venueInstant(REPORT_EVENING, EVENING_CLOCK);

  it('is the real instant for today', () => {
    expect(restAsOf(REPORT_EVENING, ZONE, EVENING)).toEqual(EVENING.toISOString());
  });

  it("projects the venue's time of day onto a past day, which a past-dated tournament needs", () => {
    expect(restAsOf(PAST_DAY, ZONE, EVENING)).toEqual(venueInstant(PAST_DAY, EVENING_CLOCK).toISOString());
  });

  it('keeps the seconds: a whole-minute zone offset cannot move them', () => {
    const now = new Date(EVENING.getTime() + 42_500);
    expect(restAsOf(PAST_DAY, ZONE, now)).toEqual(
      new Date(venueInstant(PAST_DAY, EVENING_CLOCK).getTime() + 42_500).toISOString(),
    );
  });

  it('is the real instant for a FUTURE day, which lies before that day began', () => {
    expect(restAsOf('2026-09-12', ZONE, EVENING)).toEqual(EVENING.toISOString());
    expect(restAsOf('2026-09-14', ZONE, EVENING)).toEqual(EVENING.toISOString());
  });

  it('is the real instant when no day is named', () => {
    expect(restAsOf(null, ZONE, EVENING)).toEqual(EVENING.toISOString());
  });
});

/**
 * The scenario that was reported: a backdraw final at 12:00, its semifinal at 09:00 with the score
 * entered from the operator's real clock four days later — and a schedule open on a tournament date
 * that is not that clock's calendar today, which `resolveScheduleDate()` produces for any tournament
 * whose dates have all passed. Measured against a real `now`, the semifinal sits days in the past
 * and the player reads as rested for thousands of minutes; against the projected instant the score
 * entry reads 33 minutes ago.
 */
describe('end to end: a real score entry against a past-dated schedule day', () => {
  const VIEWED = '2026-08-20';
  const NOW = venueInstant('2026-08-24', '11:11');

  const semi: ReadinessMatchUp = {
    matchUpId: 'm-semi',
    matchUpType: 'SINGLES',
    matchUpStatus: 'COMPLETED',
    winningSide: 1,
    sides: [{ participantId: 'p-alice', participantName: 'Alice' }, { participantId: 'p-chen' }],
    schedule: {
      scheduledDate: VIEWED,
      scheduledTime: '09:00',
      scoredTime: venueInstant('2026-08-24', '10:38').toISOString(),
    },
  };
  const final: ReadinessMatchUp = {
    matchUpId: 'm-final',
    matchUpType: 'SINGLES',
    sides: [{ participantId: 'p-alice', participantName: 'Alice' }, { participantId: 'p-bob' }],
    schedule: { scheduledDate: VIEWED, scheduledTime: '12:00' },
  };
  const alice = () =>
    restFor([final, semi], 'm-final', restAsOf(VIEWED, ZONE, NOW), VIEWED).rows.find(
      (row: RestRow) => row.participantId === 'p-alice',
    );

  it('measures rest from the score entry rather than reporting it unmeasurable', () => {
    expect(alice()).toMatchObject({ restMinutes: 33, source: 'scoredTime' });
    expect(alice()?.anchorUnreliable).toBeUndefined();
  });

  it('counts the semifinal as load, so the final is the second match of the day', () => {
    expect(alice()?.load.ordinal).toBe(2);
  });

  it('would report thousands of minutes against the real instant — the defect, pinned', () => {
    const real = restFor([final, semi], 'm-final', NOW.toISOString(), VIEWED).rows.find(
      (row: RestRow) => row.participantId === 'p-alice',
    );
    expect(real?.source).not.toEqual('scoredTime');
  });
});

/**
 * The future-day half. Reported from production on BOBOCA `a4e439fa-…`: tomorrow's schedule, opened
 * the evening before, badged a 07:45 singles card "on court" in a tournament with no courts and no
 * results, because the same player's 15:00 doubles read as under way against a clock projected from
 * the operator's evening.
 */
describe('a future schedule day: nobody is on court yet', () => {
  const TOMORROW = '2026-09-12';
  const EVENING = venueInstant('2026-09-11', '22:51');

  const singles: ReadinessMatchUp = {
    matchUpId: 'm-singles',
    matchUpType: 'SINGLES',
    matchUpStatus: 'TO_BE_PLAYED',
    sides: [{ participantId: 'p-nassar', participantName: 'Caden-Chady Nassar' }, { participantId: 'p-soares' }],
    schedule: { scheduledDate: TOMORROW, scheduledTime: '07:45' },
  };
  const doubles: ReadinessMatchUp = {
    matchUpId: 'm-doubles',
    matchUpType: 'DOUBLES',
    matchUpStatus: 'TO_BE_PLAYED',
    sides: [
      { participant: { participantId: 'pair-a', individualParticipantIds: ['p-livson', 'p-nassar'] } },
      { participant: { participantId: 'pair-b', individualParticipantIds: ['p-x', 'p-y'] } },
    ],
    schedule: { scheduledDate: TOMORROW, scheduledTime: '15:00' },
  };

  it('reports no prior match for every player', () => {
    const { rows } = restFor([singles, doubles], 'm-singles', restAsOf(TOMORROW, ZONE, EVENING), TOMORROW);
    expect(rows.every((row: RestRow) => row.status === 'none')).toBe(true);
  });

  it('would badge the shared player "on court" under the projected evening clock', () => {
    // The defect, pinned: the same data with the evening's time-of-day projected onto tomorrow puts
    // the 15:00 doubles behind the clock and the player on court.
    const projected = venueInstant(TOMORROW, '22:51').toISOString();
    const { rows } = restFor([singles, doubles], 'm-singles', projected, TOMORROW);
    expect(rows.find((row: RestRow) => row.participantId === 'p-nassar')?.status).toBe('onCourt');
  });
});

/**
 * The structural half of the two-viewed-dates fix. Syncing the store's
 * `selectedDate` (courthive-components 3.15.1) makes the two surfaces agree
 * today; taking the date off the matchUp makes them unable to disagree.
 */
describe('restDateFor — a scheduled matchUp carries its own day', () => {
  it("prefers the matchUp's own scheduledDate over the ambient viewed date", () => {
    const matchUp: ReadinessMatchUp = { matchUpId: 'm1', schedule: { scheduledDate: DATE } };
    expect(restDateFor(matchUp, '2026-01-01')).toBe(DATE);
  });

  it('falls back to the viewed date for an unscheduled catalog card', () => {
    expect(restDateFor({ matchUpId: 'm1', schedule: {} }, DATE)).toBe(DATE);
    expect(restDateFor(undefined, DATE)).toBe(DATE);
  });

  it('returns null only when neither the matchUp nor the page names a day', () => {
    expect(restDateFor({ matchUpId: 'm1', schedule: {} }, null)).toBeNull();
  });
});

describe('describeDiscarded — a dropped rung is named, not buried', () => {
  const base: RestRow = {
    participantId: 'p1',
    participantName: 'Alice',
    status: 'resting',
    requiredMinutes: 60,
    typeChange: false,
    load: { singles: 1, doubles: 0, total: 1, ordinal: 2, atLimit: [] },
  };

  it('says nothing when nothing was dropped', () => {
    expect(describeDiscarded(base)).toBe('');
    expect(describeDiscarded({ ...base, discardedSources: [] })).toBe('');
  });

  it('names each dropped rung in plain words rather than provenance phrasing', () => {
    const text = describeDiscarded({ ...base, discardedSources: ['endTime', 'scoredTime'] });
    expect(text).toContain('recorded end time');
    expect(text).toContain('score entry');
    // The `source.*` labels are provenance claims and read as nonsense here.
    expect(text).not.toContain('from score entry (est.)');
  });
});

// ── Regressions: rendering for the states added on 2026-08-23 ────────────────

describe('describeRest — states that carry no measurable interval', () => {
  const base = {
    participantId: 'p1',
    participantName: 'Alice',
    requiredMinutes: 60,
    typeChange: false,
    load: { singles: 1, doubles: 0, total: 1, ordinal: 2, atLimit: [] },
  };

  it('never emits a dangling "ready" with no time when the anchor is unreliable', () => {
    const text = describeRest({ ...base, status: 'resting', restMinutes: 0, anchorUnreliable: true } as RestRow);
    expect(text).not.toMatch(/ready\s*$/);
    expect(text).not.toMatch(/\b0m\b/);
  });

  it('reports an overrunning match as past its expected finish, not as a time already gone by', () => {
    const text = describeRest({ ...base, status: 'onCourt', overrun: true } as RestRow);
    expect(text).not.toMatch(/\d{2}:\d{2}/);
    expect(text).toMatch(/expected/i);
  });

  it('still names the projected finish while the match is inside its expected duration', () => {
    const text = describeRest({ ...base, status: 'onCourt', readyAt: '16:00' } as RestRow);
    expect(text).toMatch(/16:00/);
  });
});
