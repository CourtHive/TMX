import {
  describeDiscarded,
  describeRest,
  instantLocalDate,
  normalizeTimes,
  nowDayMinutes,
  restDateFor,
  toDayMinutesFromClock,
  toDayMinutesFromInstant,
} from './inspectorRest';
import { analyzeParticipantRest } from './participantRest';
import { describe, expect, it } from 'vitest';

// constants and types
import type { ReadinessMatchUp } from './matchUpReadiness';
import type { RestRow } from './participantRest';

const DATE = '2026-08-22';
const NEXT_DAY = '2026-08-23';
const UNPARSEABLE = 'not-a-date';

/**
 * `pnpm test` pins `TZ=UTC`, but these assertions are deliberately written to
 * hold in ANY zone: every instant is built by parsing a naive local datetime and
 * re-serialising it, so the expected minute figure is a statement about local
 * wall clock rather than about UTC. Running `vitest` directly (no `TZ=UTC`) must
 * produce the same result — that was not true of the first draft of this file,
 * and the difference is exactly the offset bug the feature has to avoid.
 */

/** An ISO instant that IS `hh:mm` in the runner's local zone on `date`. */
function localInstant(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00`).toISOString();
}
describe('toDayMinutesFromClock — bare wall clock, sliced never converted', () => {
  it('parses military HH:MM', () => {
    expect(toDayMinutesFromClock('00:00')).toBe(0);
    expect(toDayMinutesFromClock('09:05')).toBe(545);
    expect(toDayMinutesFromClock('14:20')).toBe(860);
    expect(toDayMinutesFromClock('23:59')).toBe(1439);
  });

  it('slices the naive wall-clock portion of an ISO string, matching the factory extractTime', () => {
    expect(toDayMinutesFromClock('2026-08-22T14:20:00.000Z')).toBe(860);
    expect(toDayMinutesFromClock('2026-08-22T14:20')).toBe(860);
  });

  it('rejects unparseable and out-of-range values rather than guessing', () => {
    for (const value of [undefined, '', 'later', '24:00', '12:60', 'TBD']) {
      expect(toDayMinutesFromClock(value)).toBeUndefined();
    }
  });
});

describe('toDayMinutesFromInstant — UTC instant against local midnight of the viewed day', () => {
  it('converts an instant on the viewed day to its local wall-clock minute', () => {
    expect(toDayMinutesFromInstant(localInstant(DATE, '13:48'), DATE)).toBe(828);
    expect(toDayMinutesFromInstant(localInstant(DATE, '00:00'), DATE)).toBe(0);
  });

  it('is a conversion, not a string slice — a UTC stamp is NOT read as wall clock', () => {
    // In a zone offset from UTC these two disagree; asserting they agree only
    // when the offset is zero is what makes this a real falsifier rather than a
    // restatement of the implementation.
    const utcNoon = '2026-08-22T12:00:00.000Z';
    const offsetMinutes = -new Date(`${DATE}T00:00:00`).getTimezoneOffset();
    expect(toDayMinutesFromInstant(utcNoon, DATE)).toBe(720 + offsetMinutes);
  });

  it('returns a NEGATIVE value for an instant on the previous day', () => {
    // A string slice could never produce this; it is the falsifier for the
    // instant-vs-wall-clock distinction the whole feature depends on.
    expect(toDayMinutesFromInstant(localInstant('2026-08-21', '22:30'), DATE)).toBe(-90);
  });

  it('returns a value ABOVE 1439 for an instant on the following day', () => {
    expect(toDayMinutesFromInstant(localInstant(NEXT_DAY, '00:30'), DATE)).toBe(1470);
  });

  it('returns undefined for a missing instant, a missing date, or an unparseable stamp', () => {
    expect(toDayMinutesFromInstant(undefined, DATE)).toBeUndefined();
    expect(toDayMinutesFromInstant(localInstant(DATE, '13:48'), null)).toBeUndefined();
    expect(toDayMinutesFromInstant(UNPARSEABLE, DATE)).toBeUndefined();
    expect(toDayMinutesFromInstant(localInstant(DATE, '13:48'), UNPARSEABLE)).toBeUndefined();
  });
});

describe('instantLocalDate — the LOCAL calendar day of an instant', () => {
  it('names the local day, not the UTC one', () => {
    expect(instantLocalDate(localInstant(DATE, '00:05'))).toBe(DATE);
    expect(instantLocalDate(localInstant(DATE, '23:55'))).toBe(DATE);
    expect(instantLocalDate(localInstant(NEXT_DAY, '12:00'))).toBe(NEXT_DAY);
  });

  it('zero-pads single-digit months and days', () => {
    expect(instantLocalDate(localInstant('2026-01-05', '12:00'))).toBe('2026-01-05');
  });

  it('returns undefined rather than a guess for a missing or unparseable stamp', () => {
    expect(instantLocalDate(undefined)).toBeUndefined();
    expect(instantLocalDate(UNPARSEABLE)).toBeUndefined();
  });
});

/**
 * The regression that took the whole feature dark for anyone operating a
 * tournament whose scheduled dates are not the operator's calendar today —
 * which `resolveScheduleDate()` produces automatically once every tournament
 * date is in the past.
 */
describe('toDayMinutesFromInstant — a stamp more than a day away reads as its time of day', () => {
  it('reports the time of day, NOT the elapsed interval, for a stamp days after the viewed date', () => {
    // Four days on from the viewed day. The elapsed reading was 4 * 1440 + 638.
    expect(toDayMinutesFromInstant(localInstant('2026-08-26', '10:38'), DATE)).toBe(638);
  });

  it('does the same for a stamp days BEFORE the viewed date', () => {
    expect(toDayMinutesFromInstant(localInstant('2026-08-18', '10:38'), DATE)).toBe(638);
  });

  it('leaves a score entered minutes ago BEHIND a now projected onto the viewed day', () => {
    // The defect in one line: today 10:38, schedule open on a past tournament
    // date, operator looking at 11:19. Rest is 41 minutes and must be readable.
    const scored = toDayMinutesFromInstant(localInstant('2026-08-26', '10:38'), DATE);
    const projectedNow = 11 * 60 + 19;
    expect(scored).toBeLessThan(projectedNow);
    expect(projectedNow - (scored ?? 0)).toBe(41);
  });
});

describe('normalizeTimes', () => {
  function matchUp(schedule: ReadinessMatchUp['schedule']): ReadinessMatchUp {
    return { matchUpId: 'm1', schedule };
  }

  it('normalizes each field from its own frame', () => {
    const result = normalizeTimes(
      matchUp({
        scheduledDate: DATE,
        scheduledTime: '10:00',
        startTime: '10:07',
        endTime: '12:06',
        calledAt: localInstant(DATE, '09:55'),
        scoredTime: localInstant(DATE, '12:11'),
      }),
      DATE,
    );

    expect(result).toEqual({
      endMinutes: 726,
      scoredMinutes: 731,
      scoredDate: DATE,
      startMinutes: 607,
      calledMinutes: 595,
      scheduledMinutes: 600,
    });
  });

  it('rolls endTime onto the next day when END_DATE says the match crossed midnight', () => {
    const result = normalizeTimes(
      matchUp({ scheduledDate: DATE, scheduledTime: '22:30', endTime: '00:40', endDate: NEXT_DAY }),
      DATE,
    );
    expect(result.endMinutes).toBe(1480);
    expect(result.scheduledMinutes).toBe(1350);
  });

  it('does not roll endTime when END_DATE equals the scheduled date', () => {
    const result = normalizeTimes(matchUp({ scheduledDate: DATE, endTime: '12:06', endDate: DATE }), DATE);
    expect(result.endMinutes).toBe(726);
  });

  it('omits endMinutes entirely when no END_TIME was recorded — the common case', () => {
    const result = normalizeTimes(matchUp({ scheduledDate: DATE, scoredTime: localInstant(DATE, '12:11') }), DATE);
    expect(result.endMinutes).toBeUndefined();
    expect(result.scoredMinutes).toBe(731);
  });

  it('yields nothing usable for a matchUp with no schedule at all', () => {
    const result = normalizeTimes({ matchUpId: 'm1', schedule: null }, DATE);
    expect(Object.values(result).every((value) => value === undefined)).toBe(true);
  });
});

/**
 * The two halves joined, on the scenario that was reported: a backdraw final at
 * 12:00, its semifinals at 09:00 with scores entered from the operator's real
 * clock — and a schedule open on a tournament date that is not that clock's
 * calendar today, which `resolveScheduleDate()` produces for any tournament
 * whose dates have all passed.
 *
 * Neither module could catch this alone. `normalizeTimes` looked right in
 * isolation and `analyzeParticipantRest` behaved correctly on the numbers it was
 * handed; the defect lived entirely in the frame they exchanged.
 */
describe('end to end: a real score entry against a past-dated schedule day', () => {
  const VIEWED = '2026-08-20';
  const TODAY = '2026-08-24';
  const TIMING = { averageMinutes: 90, recoveryMinutes: 60, typeChangeRecoveryMinutes: 30 };
  const NOW = 11 * 60 + 11; // 11:11, projected onto the viewed day

  const semi: ReadinessMatchUp = {
    matchUpId: 'm-semi',
    matchUpType: 'SINGLES',
    matchUpStatus: 'COMPLETED',
    winningSide: 1,
    sides: [{ participantId: 'p-alice', participantName: 'Alice' }, { participantId: 'p-chen' }],
    schedule: { scheduledDate: VIEWED, scheduledTime: '09:00', scoredTime: localInstant(TODAY, '10:38') },
  };
  const final: ReadinessMatchUp = {
    matchUpId: 'm-final',
    matchUpType: 'SINGLES',
    sides: [{ participantId: 'p-alice', participantName: 'Alice' }, { participantId: 'p-bob' }],
    schedule: { scheduledDate: VIEWED, scheduledTime: '12:00' },
  };

  function analyze() {
    const result = analyzeParticipantRest({
      matchUpId: 'm-final',
      matchUps: [final, semi],
      scheduledDate: VIEWED,
      asOfMinutes: NOW,
      timingFor: () => TIMING,
      timesFor: (matchUp) => normalizeTimes(matchUp, VIEWED),
    });
    if (!result.evaluated) throw new Error('expected evaluation');
    return result;
  }

  it('measures rest from the score entry rather than reporting it unmeasurable', () => {
    const alice = analyze().rows.find((row) => row.participantId === 'p-alice');
    expect(alice).toMatchObject({ status: 'resting', restMinutes: 33, source: 'scoredTime' });
    expect(alice?.anchorUnreliable).toBeUndefined();
  });

  it('counts the semifinal as load, so the final is the second match of the day', () => {
    expect(analyze().rows.find((row) => row.participantId === 'p-alice')?.load.ordinal).toBe(2);
  });

  it('projects a readyAt from the anchor it actually used', () => {
    // 10:38 + 60 minutes of recovery.
    expect(analyze().rows.find((row) => row.participantId === 'p-alice')?.readyAt).toBe('11:38');
  });
});

/**
 * The future-day half of the projection rule. Reported from production on BOBOCA
 * `a4e439fa-…`: the schedule page for the next day, opened the evening before,
 * badged a 07:45 singles card "on court" in a tournament that had no courts and
 * no results — because the same player's 15:00 doubles read as already under way
 * against a clock projected from the operator's evening.
 *
 * Written against the runner's own zone rather than a named one, like the rest of
 * this file: the assertion is about the DAY offset, which no zone changes.
 */
describe('nowDayMinutes — the projection runs backwards in time, never forwards', () => {
  /** 22:51 local on 2026-09-11 — the evening the production report came from. */
  const EVENING = new Date('2026-09-11T22:51:00');
  const EVENING_MINUTES = 22 * 60 + 51;

  it('projects onto today unchanged', () => {
    expect(nowDayMinutes(undefined, '2026-09-11', EVENING)).toBe(EVENING_MINUTES);
  });

  it('projects onto a past day unchanged, which is what a past-dated tournament needs', () => {
    expect(nowDayMinutes(undefined, '2026-09-08', EVENING)).toBe(EVENING_MINUTES);
  });

  it('places "now" before midnight of a future day, by a whole day per day ahead', () => {
    expect(nowDayMinutes(undefined, '2026-09-12', EVENING)).toBe(EVENING_MINUTES - 1440);
    expect(nowDayMinutes(undefined, '2026-09-14', EVENING)).toBe(EVENING_MINUTES - 3 * 1440);
  });

  it('falls back to the bare time of day when no day is named or the day is unparseable', () => {
    expect(nowDayMinutes(undefined, null, EVENING)).toBe(EVENING_MINUTES);
    expect(nowDayMinutes(undefined, UNPARSEABLE, EVENING)).toBe(EVENING_MINUTES);
  });
});

/**
 * The defect end to end: two matchUps on tomorrow's card sharing one player, no
 * scores, no courts. Before the fix the earlier one reported its shared player
 * `onCourt`, because the later one's scheduledTime sat behind a projected clock.
 */
describe('a future schedule day: nobody is on court yet', () => {
  const TOMORROW = '2026-09-12';
  const EVENING = new Date('2026-09-11T22:51:00');
  const TIMING = { averageMinutes: 90, recoveryMinutes: 60 };

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

  function analyze(asOfMinutes: number) {
    const result = analyzeParticipantRest({
      matchUpId: 'm-singles',
      matchUps: [singles, doubles],
      scheduledDate: TOMORROW,
      asOfMinutes,
      timingFor: () => TIMING,
      timesFor: (matchUp) => normalizeTimes(matchUp, TOMORROW),
    });
    if (!result.evaluated) throw new Error('expected evaluation');
    return result;
  }

  it('reports no prior match for every player', () => {
    const rows = analyze(nowDayMinutes(undefined, TOMORROW, EVENING)).rows;
    expect(rows.every((row) => row.status === 'none')).toBe(true);
  });

  it('would badge the shared player "on court" under the projected evening clock', () => {
    // The defect, pinned: the same data with today's time-of-day projected onto
    // tomorrow puts the 15:00 doubles behind the clock and the player on court.
    const rows = analyze(22 * 60 + 51).rows;
    expect(rows.find((row) => row.participantId === 'p-nassar')?.status).toBe('onCourt');
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
