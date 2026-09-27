import { describe, expect, it } from 'vitest';

import { analyzeMatchUpReadiness, earliestStart, individualIds, minutesToClock, nameFor } from './matchUpReadiness';

// constants and types
import type { ReadinessMatchUp, ReadinessTiming } from './matchUpReadiness';

/**
 * Every finding kind is asserted as a PAIR: once where it fires, and once where
 * the same fixture minus the offending condition stays silent. A single green
 * assertion would not show the rule is wired to anything.
 */

const DATE = '2026-06-15';
const OTHER_DATE = '2026-06-16';

const TIMING_90_30: ReadinessTiming = { averageMinutes: 90, recoveryMinutes: 30 };
const timing =
  (t: ReadinessTiming = TIMING_90_30) =>
  () =>
    t;

function player(participantId: string, participantName: string) {
  return { participantId, participantName };
}

function matchUp(overrides: Partial<ReadinessMatchUp> & { matchUpId: string }): ReadinessMatchUp {
  return {
    roundName: 'R16',
    sides: [player('p1', 'Alice'), player('p2', 'Bob')],
    ...overrides,
  };
}

function scheduled(time: string, date = DATE) {
  return { scheduledDate: date, scheduledTime: time };
}

const kinds = (result: any): string[] => result.findings.map((f: any) => f.kind);

describe('minutesToClock', () => {
  it('formats and zero-pads', () => {
    expect(minutesToClock(540)).toBe('09:00');
    expect(minutesToClock(605)).toBe('10:05');
  });

  it('wraps past midnight rather than emitting 25:xx', () => {
    expect(minutesToClock(1500)).toBe('01:00');
  });
});

describe('individualIds', () => {
  it('expands a doubles side to its members and does not also count the pair', () => {
    const ids = individualIds(
      matchUp({
        matchUpId: 'M',
        sides: [
          { participantId: 'pair1', participant: { participantId: 'pair1', individualParticipantIds: ['a', 'b'] } },
          player('p2', 'Bob'),
        ],
      }),
    );
    expect(ids).toEqual(['a', 'b', 'p2']);
    expect(ids).not.toContain('pair1');
  });

  it('falls back to the side participantId when members are unknown', () => {
    const ids = individualIds(matchUp({ matchUpId: 'M', sides: [{ participantId: 'solo' }] }));
    expect(ids).toEqual(['solo']);
  });
});

/**
 * `nameFor` answers about a PERSON — a rest row measures one player's recovery, a
 * clash finding names who is in two places at once. It used to fall through to the
 * side label for anyone inside a pair, so a doubles entrant was named after their
 * pair.
 */
describe('nameFor', () => {
  const AIDEN = 'p-aiden';
  const AIDEN_NAME = 'Aiden Phoebus';
  const PAIR_NAME = 'Phoebus/Smith';

  const hydratedPair = (): any => ({
    participantId: 'pair1',
    participant: {
      participantId: 'pair1',
      participantName: PAIR_NAME,
      individualParticipantIds: [AIDEN, 'p-ravi'],
      individualParticipants: [
        { participantId: AIDEN, participantName: AIDEN_NAME },
        { participantId: 'p-ravi', participantName: 'Ravi Smith' },
      ],
    },
  });

  it('names a singles player from their own side', () => {
    const singles = matchUp({ matchUpId: 'S', sides: [player(AIDEN, AIDEN_NAME), player('p2', 'Bob')] });
    expect(nameFor(AIDEN, [singles])).toBe(AIDEN_NAME);
  });

  it('names a PAIR MEMBER by their own name, not by the pair', () => {
    // The fix. A row standing for one person was labelled with two.
    const doubles = matchUp({ matchUpId: 'D', sides: [hydratedPair(), player('p2', 'Bob')] });
    expect(nameFor(AIDEN, [doubles])).toBe(AIDEN_NAME);
    expect(nameFor(AIDEN, [doubles])).not.toBe(PAIR_NAME);
  });

  it('gives the same answer whichever event comes first', () => {
    // It used to depend on the order `allTournamentMatchUps` returned events in: a
    // player entered in both got their own name from the singles side or their
    // pair's from the doubles side, whichever the walk reached first.
    const singles = matchUp({ matchUpId: 'S', sides: [player(AIDEN, AIDEN_NAME), player('p2', 'Bob')] });
    const doubles = matchUp({ matchUpId: 'D', sides: [hydratedPair(), player('p3', 'Cass')] });
    expect(nameFor(AIDEN, [singles, doubles])).toBe(AIDEN_NAME);
    expect(nameFor(AIDEN, [doubles, singles])).toBe(AIDEN_NAME);
  });

  it('falls back to the pair label when the members were not hydrated', () => {
    // A worse answer than the person's name, a much better one than a raw id.
    const unhydrated = matchUp({
      matchUpId: 'D',
      sides: [
        {
          participantId: 'pair1',
          participant: { participantId: 'pair1', participantName: PAIR_NAME, individualParticipantIds: [AIDEN] },
        },
      ],
    });
    expect(nameFor(AIDEN, [unhydrated])).toBe(PAIR_NAME);
  });

  it('falls back to the participantId when no side carries the participant', () => {
    expect(nameFor('p-nobody', [matchUp({ matchUpId: 'M' })])).toBe('p-nobody');
  });

  it('names BOTH members when a pair clashes with itself, rather than deduping to one', () => {
    // `toFinding` dedupes `participantNames` through a Set. Two members named after
    // the same pair collapsed to a single entry, so a finding affecting two people
    // reported one.
    const target = matchUp({ matchUpId: 'T', schedule: scheduled('10:00'), sides: [hydratedPair()] });
    const neighbour = matchUp({ matchUpId: 'N', schedule: scheduled('09:30'), sides: [hydratedPair()] });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, neighbour],
      timingFor: timing(),
    });
    expect(result.findings[0].participantNames).toEqual([AIDEN_NAME, 'Ravi Smith']);
  });
});

describe('analyzeMatchUpReadiness — not evaluated', () => {
  const target = matchUp({ matchUpId: 'T', schedule: scheduled('10:00') });

  it('reports unknownMatchUp when the id is absent', () => {
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'nope', matchUps: [target], timingFor: timing() });
    expect(result).toEqual({ evaluated: false, reason: 'unknownMatchUp' });
  });

  it('skips a BYE', () => {
    const bye = matchUp({ matchUpId: 'T', matchUpStatus: 'BYE', schedule: scheduled('10:00') });
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [bye], timingFor: timing() });
    expect(result.reason).toBe('bye');
  });

  it('skips a completed matchUp — by status and by winningSide', () => {
    const byStatus = matchUp({ matchUpId: 'T', matchUpStatus: 'COMPLETED', schedule: scheduled('10:00') });
    const byWinner = matchUp({ matchUpId: 'T', winningSide: 1, schedule: scheduled('10:00') });
    expect((analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [byStatus], timingFor: timing() }) as any).reason).toBe(
      'completed',
    );
    expect((analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [byWinner], timingFor: timing() }) as any).reason).toBe(
      'completed',
    );
  });

  it('skips when unscheduled, and separately when scheduled with no time', () => {
    const unscheduled = matchUp({ matchUpId: 'T' });
    const dateOnly = matchUp({ matchUpId: 'T', schedule: { scheduledDate: DATE } });
    expect(
      (analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [unscheduled], timingFor: timing() }) as any).reason,
    ).toBe('notScheduled');
    expect((analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [dateOnly], timingFor: timing() }) as any).reason).toBe(
      'noTime',
    );
  });

  it('a clean matchUp is evaluated with no findings — not skipped', () => {
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [target], timingFor: timing() });
    expect(result.evaluated).toBe(true);
    expect(result.findings).toEqual([]);
  });
});

describe('analyzeMatchUpReadiness — overlap', () => {
  const target = matchUp({ matchUpId: 'T', schedule: scheduled('10:00') });

  it('fires when a shared participant is on court elsewhere at the start time', () => {
    // Neighbour 09:30 + 90min average runs to 11:00, so 10:00 lands inside it.
    const neighbour = matchUp({ matchUpId: 'N', schedule: scheduled('09:30'), sides: [player('p1', 'Alice')] });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, neighbour],
      timingFor: timing(),
    });
    expect(kinds(result)).toContain('overlap');
    expect(result.findings[0].participantNames).toEqual(['Alice']);
  });

  it('stays silent when the same neighbour finishes before the start time', () => {
    // 08:00 + 90 = 09:30, clear of 10:00. Recovery is 30min → free 10:00, not > 10:00.
    const neighbour = matchUp({ matchUpId: 'N', schedule: scheduled('08:00'), sides: [player('p1', 'Alice')] });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, neighbour],
      timingFor: timing(),
    });
    expect(result.findings).toEqual([]);
  });

  it('stays silent when the neighbour shares no participant', () => {
    const neighbour = matchUp({
      matchUpId: 'N',
      schedule: scheduled('09:30'),
      sides: [player('p9', 'Zoe'), player('p8', 'Yan')],
    });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, neighbour],
      timingFor: timing(),
    });
    expect(result.findings).toEqual([]);
  });

  it('stays silent when the overlapping matchUp is on another date', () => {
    const neighbour = matchUp({
      matchUpId: 'N',
      schedule: scheduled('09:30', OTHER_DATE),
      sides: [player('p1', 'Alice')],
    });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, neighbour],
      timingFor: timing(),
    });
    expect(result.findings).toEqual([]);
  });

  it('matches a doubles player against a singles neighbour via individualParticipantIds', () => {
    const doubles = matchUp({
      matchUpId: 'T',
      schedule: scheduled('10:00'),
      sides: [
        { participantId: 'pair1', participant: { participantId: 'pair1', individualParticipantIds: ['a', 'b'] } },
        { participantId: 'pair2', participant: { participantId: 'pair2', individualParticipantIds: ['c', 'd'] } },
      ],
    });
    const neighbour = matchUp({ matchUpId: 'N', schedule: scheduled('09:30'), sides: [{ participantId: 'a' }] });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [doubles, neighbour],
      timingFor: timing(),
    });
    expect(kinds(result)).toContain('overlap');
    expect(result.findings[0].participantIds).toEqual(['a']);
  });
});

describe('analyzeMatchUpReadiness — recovery', () => {
  const target = matchUp({ matchUpId: 'T', schedule: scheduled('10:00') });

  it('fires when an earlier matchUp leaves the participant inside the recovery window', () => {
    // 08:15 + 90 = 09:45, + 30 recovery = 10:15 > 10:00.
    const earlier = matchUp({ matchUpId: 'E', schedule: scheduled('08:15'), sides: [player('p1', 'Alice')] });
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [target, earlier], timingFor: timing() });
    expect(kinds(result)).toEqual(['recovery']);
    expect(result.findings[0].notBefore).toBe('10:15');
    expect(result.findings[0].participantNames).toEqual(['Alice']);
  });

  it('stays silent for the identical fixture when recoveryMinutes is 0', () => {
    const earlier = matchUp({ matchUpId: 'E', schedule: scheduled('08:15'), sides: [player('p1', 'Alice')] });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, earlier],
      timingFor: timing({ averageMinutes: 90, recoveryMinutes: 0 }),
    });
    expect(result.findings).toEqual([]);
  });

  it('prefers a real endTime over the projected average', () => {
    // Finished early at 09:00 → free 09:30, clear of 10:00, so nothing fires.
    const earlier = matchUp({
      matchUpId: 'E',
      matchUpStatus: 'COMPLETED',
      winningSide: 1,
      sides: [player('p1', 'Alice')],
      schedule: { scheduledDate: DATE, scheduledTime: '08:15', endTime: '09:00' },
    });
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [target, earlier], timingFor: timing() });
    expect(result.findings).toEqual([]);
  });

  it('overlap suppresses recovery for the same participant', () => {
    // One neighbour overlaps 10:00; another would only trigger recovery for the
    // same player. Only the stronger finding should mention Alice.
    const overlapping = matchUp({ matchUpId: 'N', schedule: scheduled('09:30'), sides: [player('p1', 'Alice')] });
    const recovering = matchUp({ matchUpId: 'E', schedule: scheduled('08:15'), sides: [player('p1', 'Alice')] });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, overlapping, recovering],
      timingFor: timing(),
    });
    expect(kinds(result)).toEqual(['overlap']);
  });

  it('still reports recovery for a DIFFERENT participant when one is overlapped', () => {
    const overlapping = matchUp({ matchUpId: 'N', schedule: scheduled('09:30'), sides: [player('p1', 'Alice')] });
    const recovering = matchUp({ matchUpId: 'E', schedule: scheduled('08:15'), sides: [player('p2', 'Bob')] });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, overlapping, recovering],
      timingFor: timing(),
    });
    expect(kinds(result)).toEqual(['overlap', 'recovery']);
    expect(result.findings[1].participantNames).toEqual(['Bob']);
  });
});

/**
 * Recovery is time owed for a match ALREADY BEGUN, and the rule is therefore
 * DIRECTIONAL. Nothing enforced that: ordering was consulted only by the overlap
 * test, so every same-day neighbour scheduled later fell through to the recovery
 * arithmetic and had its projected finish read as a floor for a matchUp hours
 * earlier.
 *
 * The first pair is the shape that matters — one fixture, graded from both ends.
 * A test that only asserted silence for a later neighbour would also pass with
 * the recovery branch deleted outright.
 */
describe('analyzeMatchUpReadiness — recovery is directional', () => {
  // Alice plays at 09:30 and again at 11:15. 09:30 + 90 = 11:00, + 30 recovery
  // = 11:30, so the pair straddles the 11:15 start: the LATER matchUp is short
  // of recovery, the earlier one owes nothing to a match it precedes.
  const early = matchUp({ matchUpId: 'EARLY', schedule: scheduled('09:30'), sides: [player('p1', 'Alice')] });
  const late = matchUp({ matchUpId: 'LATE', schedule: scheduled('11:15'), sides: [player('p1', 'Alice')] });

  it('fires when grading the later matchUp', () => {
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'LATE', matchUps: [early, late], timingFor: timing() });
    expect(kinds(result)).toEqual(['recovery']);
    expect(result.findings[0].notBefore).toBe('11:30');
  });

  it('stays silent for the same pair when grading the earlier one', () => {
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'EARLY', matchUps: [early, late], timingFor: timing() });
    expect(result.findings).toEqual([]);
  });

  /**
   * Prod 2026-09-27, `Battle of Boca` — the report this rule came from. The
   * Inspector graded a 09:30 R16 singles and reported "needs recovery time — not
   * before 16:30" off the player's 14:30 doubles semifinal, which she had not
   * walked on court for. 14:30 + 90 average + 30 recovery is exactly 16:30, four
   * lines under a rest section correctly reading "No prior match today".
   */
  it('does not charge a 09:30 singles for a 14:30 doubles the player has not played', () => {
    const singles = matchUp({ matchUpId: 'R16', schedule: scheduled('09:30'), sides: [player('p1', 'Alice')] });
    const doubles = matchUp({
      matchUpId: 'SF',
      matchUpType: 'DOUBLES',
      schedule: scheduled('14:30'),
      sides: [{ participantId: 'pair1', participant: { participantId: 'pair1', individualParticipantIds: ['p1'] } }],
    });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'R16',
      matchUps: [singles, doubles],
      timingFor: timing(),
    });
    expect(result.findings).toEqual([]);
  });

  /**
   * The gate reads `startTime` before `scheduledTime` — the same order of
   * authority `finishOf` reads them in — so it cannot excuse a neighbour that
   * went on EARLY. Suppressing by the plan would have hidden a live clash, which
   * is a worse failure than the one being fixed.
   */
  it('still fires for a neighbour scheduled later that in fact started earlier', () => {
    const target = matchUp({ matchUpId: 'T', schedule: scheduled('09:30') });
    // Planned 10:00, actually on court at 08:00 → finishes 09:30, free 10:00.
    const early = matchUp({
      matchUpId: 'E',
      sides: [player('p1', 'Alice')],
      schedule: { scheduledDate: DATE, scheduledTime: '10:00', startTime: '08:00' },
    });
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [target, early], timingFor: timing() });
    expect(kinds(result)).toEqual(['recovery']);
    expect(result.findings[0].notBefore).toBe('10:00');
  });

  /**
   * A recorded `endTime` is the last rung of the gate, and the only one that can
   * date a matchUp scheduled for the day with no time on it. Without it such a
   * neighbour has no anchor, falls through, and is charged for exactly as before.
   */
  it('reads a recorded endTime as the neighbour date of last resort', () => {
    const target = matchUp({ matchUpId: 'T', schedule: scheduled('09:30') });
    const later = matchUp({
      matchUpId: 'L',
      matchUpStatus: 'COMPLETED',
      winningSide: 1,
      sides: [player('p1', 'Alice')],
      schedule: { scheduledDate: DATE, endTime: '14:00' },
    });
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [target, later], timingFor: timing() });
    expect(result.findings).toEqual([]);
  });

  /**
   * Scheduled for the day and nothing else. Nothing dates it, so the gate cannot
   * place it and the projection cannot price it — reported by neither branch
   * rather than guessed at.
   */
  it('stays silent for a neighbour with a date but no clock at all', () => {
    const target = matchUp({ matchUpId: 'T', schedule: scheduled('09:30') });
    const undated = matchUp({ matchUpId: 'U', sides: [player('p1', 'Alice')], schedule: { scheduledDate: DATE } });
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [target, undated], timingFor: timing() });
    expect(result.findings).toEqual([]);
  });

  it('charges a neighbour whose recorded endTime is behind the start time — the control', () => {
    const target = matchUp({ matchUpId: 'T', schedule: scheduled('09:30') });
    const earlier = matchUp({
      matchUpId: 'L',
      matchUpStatus: 'COMPLETED',
      winningSide: 1,
      sides: [player('p1', 'Alice')],
      schedule: { scheduledDate: DATE, endTime: '09:15' },
    });
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [target, earlier], timingFor: timing() });
    expect(kinds(result)).toEqual(['recovery']);
    expect(result.findings[0].notBefore).toBe('09:45');
  });
});

/**
 * The directional gate skips ONE neighbour, and every case above grades a target
 * that has only the one. The arrangement reported on prod is both at once: a
 * player's day is earlier match → this match → later match, so the target sits
 * BETWEEN a neighbour that can owe recovery and a neighbour that cannot.
 *
 * Nothing pinned that. A gate written as an early exit from the pass rather than
 * from the iteration would satisfy every case above and go silent here on the
 * neighbour that really does owe — which is the failure mode that matters, since
 * suppressing a true recovery finding is worse than the false one being fixed.
 *
 * `Battle of Boca`, prod 2026-09-27, the second report off this defect: a 13:30
 * singles quarterfinal read "needs recovery time — not before 16:30" off the
 * player's 14:30 doubles, directly under a rest section correctly reading
 * "1h 54m rested — 1h 0m required" from her 09:30 R16. Her partner's opponent,
 * entered in no doubles draw, drew no finding from the identical singles day —
 * which is what identified the later matchUp as the source.
 */
describe('analyzeMatchUpReadiness — a target between an earlier and a later neighbour', () => {
  const target = matchUp({ matchUpId: 'T', roundName: 'Quarterfinal', schedule: scheduled('13:30') });
  /** Finished, and far enough back that its recovery has expired: 09:30 + 90 + 30 = 11:30. */
  const earlierSpent = matchUp({
    matchUpId: 'EARLIER',
    matchUpStatus: 'COMPLETED',
    winningSide: 1,
    sides: [player('p1', 'Alice')],
    schedule: scheduled('09:30'),
  });
  /** Finished, and recent enough to still owe: 12:30 + 90 + 30 = 14:30. */
  const earlierOwing = matchUp({
    matchUpId: 'EARLIER',
    matchUpStatus: 'COMPLETED',
    winningSide: 1,
    sides: [player('p1', 'Alice')],
    schedule: scheduled('12:30'),
  });
  /** Not played, and after the target — the neighbour the gate exists for. */
  const later = matchUp({
    matchUpId: 'LATER',
    matchUpType: 'DOUBLES',
    roundName: 'Quarterfinal',
    sides: [{ participantId: 'pair1', participant: { participantId: 'pair1', individualParticipantIds: ['p1'] } }],
    schedule: scheduled('14:30'),
  });

  it('reports nothing when the earlier neighbour is spent and the later one is only planned', () => {
    const result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, earlierSpent, later],
      timingFor: timing(),
    });
    expect(result.findings).toEqual([]);
  });

  it('still charges the earlier neighbour that owes, and names only it', () => {
    const result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, earlierOwing, later],
      timingFor: timing(),
    });
    expect(kinds(result)).toEqual(['recovery']);
    expect(result.findings[0].matchUpIds).toEqual(['EARLIER']);
    expect(result.findings[0].notBefore).toBe('14:30');
  });

  it('puts the clash on the later matchUp, where the target is the thing in the way', () => {
    // 13:30 + 90 = 15:00, so the target's playing window contains the 14:30 start.
    const result: any = analyzeMatchUpReadiness({
      matchUpId: 'LATER',
      matchUps: [target, earlierSpent, later],
      timingFor: timing(),
    });
    expect(kinds(result)).toEqual(['overlap']);
    expect(result.findings[0].matchUpIds).toEqual(['T']);
    expect(result.findings[0].participantNames).toEqual(['Alice']);
  });
});

describe('analyzeMatchUpReadiness — dependency', () => {
  // S feeds T: S.winnerMatchUpId === 'T'.
  const source = (overrides: Partial<ReadinessMatchUp> = {}) =>
    matchUp({ matchUpId: 'S', roundName: 'R32', winnerMatchUpId: 'T', sides: [player('p3', 'Cara')], ...overrides });
  const target = matchUp({ matchUpId: 'T', schedule: scheduled('10:00'), sides: [player('p1', 'Alice'), {}] });

  it('fires when an incomplete upstream matchUp projects to finish after the start time', () => {
    // 09:00 + 90 = 10:30 > 10:00.
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, source({ schedule: scheduled('09:00') })],
      timingFor: timing(),
    });
    expect(kinds(result)).toContain('dependency');
    const dependency = result.findings.find((f: any) => f.kind === 'dependency');
    expect(dependency.notBefore).toBe('10:30');
    expect(dependency.matchUpLabels).toEqual(['R32: Cara']);
  });

  it('stays silent for the identical fixture when the upstream finishes in time', () => {
    // 08:00 + 90 = 09:30 <= 10:00.
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, source({ schedule: scheduled('08:00') })],
      timingFor: timing(),
    });
    expect(kinds(result)).not.toContain('dependency');
  });

  it('fires with no notBefore when the upstream is not scheduled at all', () => {
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, source()],
      timingFor: timing(),
    });
    const dependency = result.findings.find((f: any) => f.kind === 'dependency');
    expect(dependency).toBeTruthy();
    expect(dependency.notBefore).toBeUndefined();
  });

  it('stays silent when the upstream is complete', () => {
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, source({ winningSide: 1, matchUpStatus: 'COMPLETED' })],
      timingFor: timing(),
    });
    expect(kinds(result)).not.toContain('dependency');
  });

  it('walks transitively — a grandparent blocks too', () => {
    const grandparent = matchUp({ matchUpId: 'G', roundName: 'R64', winnerMatchUpId: 'S', sides: [] });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, source({ schedule: scheduled('09:00') }), grandparent],
      timingFor: timing(),
    });
    const ids = result.findings.filter((f: any) => f.kind === 'dependency').flatMap((f: any) => f.matchUpIds);
    expect(ids).toContain('G');
  });

  it('stops the walk at a finished parent — its own parents cannot still be pending', () => {
    const grandparent = matchUp({ matchUpId: 'G', winnerMatchUpId: 'S', sides: [] });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, source({ winningSide: 1 }), grandparent],
      timingFor: timing(),
    });
    const ids = result.findings.flatMap((f: any) => f.matchUpIds ?? []);
    expect(ids).not.toContain('G');
  });

  it('follows loserMatchUpId as well as winnerMatchUpId', () => {
    const consolationSource = matchUp({
      matchUpId: 'L',
      roundName: 'R32',
      loserMatchUpId: 'T',
      sides: [player('p4', 'Dee')],
    });
    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [target, consolationSource],
      timingFor: timing(),
    });
    expect(result.findings.flatMap((f: any) => f.matchUpIds ?? [])).toContain('L');
  });
});

describe('analyzeMatchUpReadiness — undetermined', () => {
  it('fires when a side has no participant and an upstream matchUp is incomplete', () => {
    const target = matchUp({ matchUpId: 'T', schedule: scheduled('10:00'), sides: [player('p1', 'Alice'), {}] });
    const source = matchUp({ matchUpId: 'S', winnerMatchUpId: 'T', schedule: scheduled('08:00'), sides: [] });
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [target, source], timingFor: timing() });
    expect(kinds(result)).toEqual(['undetermined']);
    expect(result.findings[0].severity).toBe('INFO');
  });

  it('stays silent for the identical fixture when both sides are known', () => {
    const target = matchUp({ matchUpId: 'T', schedule: scheduled('10:00') });
    const source = matchUp({ matchUpId: 'S', winnerMatchUpId: 'T', schedule: scheduled('08:00'), sides: [] });
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [target, source], timingFor: timing() });
    expect(result.findings).toEqual([]);
  });

  it('stays silent when the side is unknown but nothing upstream is pending', () => {
    const target = matchUp({ matchUpId: 'T', schedule: scheduled('10:00'), sides: [player('p1', 'Alice'), {}] });
    let result: any = analyzeMatchUpReadiness({ matchUpId: 'T', matchUps: [target], timingFor: timing() });
    expect(result.findings).toEqual([]);
  });
});

describe('analyzeMatchUpReadiness — ordering', () => {
  it('returns findings strongest-first', () => {
    const target = matchUp({ matchUpId: 'T', schedule: scheduled('10:00'), sides: [player('p1', 'Alice'), {}] });
    const overlapping = matchUp({ matchUpId: 'N', schedule: scheduled('09:30'), sides: [player('p1', 'Alice')] });
    const recovering = matchUp({ matchUpId: 'E', schedule: scheduled('08:15'), sides: [player('p2', 'Bob')] });
    const source = matchUp({ matchUpId: 'S', winnerMatchUpId: 'T', schedule: scheduled('09:00'), sides: [] });
    const targetWithBob = { ...target, sides: [player('p1', 'Alice'), player('p2', 'Bob')] };

    let result: any = analyzeMatchUpReadiness({
      matchUpId: 'T',
      matchUps: [targetWithBob, overlapping, recovering, source],
      timingFor: timing(),
    });
    expect(kinds(result)).toEqual(['overlap', 'dependency', 'recovery']);
  });
});

describe('a dependency carries BOTH the court-free and the player-ready time', () => {
  // The panel was quietly answering one question two ways: readiness reported
  // when the upstream FINISHES, while rest's pendingUpstream row reported the
  // recovery-inclusive figure for the same situation. Both are now carried.
  const upstream = (over: Partial<ReadinessMatchUp> = {}): ReadinessMatchUp => ({
    matchUpId: 'qf',
    matchUpType: 'SINGLES',
    winnerMatchUpId: 'sf',
    sides: [{ participantId: 'p1' }, { participantId: 'p2' }],
    schedule: { scheduledDate: DATE, scheduledTime: '14:00' },
    ...over,
  });
  const target = (): ReadinessMatchUp => ({
    matchUpId: 'sf',
    matchUpType: 'SINGLES',
    sides: [{}, { participantId: 'p9' }],
    schedule: { scheduledDate: DATE, scheduledTime: '14:30' },
  });

  const analyze = (timing: { averageMinutes: number; recoveryMinutes: number }, matchUps: ReadinessMatchUp[]) =>
    analyzeMatchUpReadiness({ matchUpId: 'sf', matchUps, timingFor: () => timing });

  it('reports the finish and, separately, when the winner could start', () => {
    const result: any = analyze({ averageMinutes: 90, recoveryMinutes: 60 }, [target(), upstream()]);
    const dependency = result.findings.find((f: any) => f.kind === 'dependency');
    // 14:00 + 90 = 15:30 court-free; + 60 recovery = 16:30 player-ready.
    expect(dependency.notBefore).toBe('15:30');
    expect(dependency.readyAt).toBe('16:30');
  });

  it('omits readyAt when recovery is zero — one figure twice is not precision', () => {
    const result: any = analyze({ averageMinutes: 90, recoveryMinutes: 0 }, [target(), upstream()]);
    const dependency = result.findings.find((f: any) => f.kind === 'dependency');
    expect(dependency.notBefore).toBe('15:30');
    expect(dependency.readyAt).toBeUndefined();
  });

  it('projects from a recorded end time when there is one, rather than the average', () => {
    const played = upstream({ schedule: { scheduledDate: DATE, scheduledTime: '14:00', endTime: '15:00' } });
    const result: any = analyze({ averageMinutes: 90, recoveryMinutes: 60 }, [target(), played]);
    const dependency = result.findings.find((f: any) => f.kind === 'dependency');
    // BOTH figures come off the recorded end. This test used to assert
    // `15:30 → 16:00`, which was two anchors rendered as one arithmetic: the
    // finish from the plan, the ready figure from the recorded end. 15:30 plus
    // an hour of recovery is not 16:00, and the panel showed exactly that.
    expect(dependency.notBefore).toBe('15:00');
    expect(dependency.readyAt).toBe('16:00');
  });

  it('projects from when the upstream ACTUALLY started, not from when it was planned to', () => {
    // The divergence that started this: a feeder that went on forty minutes late
    // carries the evidence in `startTime`, and the old ladder discarded it —
    // so readiness promised a court and a winner earlier than either would exist.
    const late = upstream({ schedule: { scheduledDate: DATE, scheduledTime: '14:00', startTime: '14:40' } });
    const result: any = analyze({ averageMinutes: 90, recoveryMinutes: 60 }, [target(), late]);
    const dependency = result.findings.find((f: any) => f.kind === 'dependency');
    expect(dependency.notBefore).toBe('16:10');
    expect(dependency.readyAt).toBe('17:10');
  });

  it('always reconciles: readyAt is notBefore plus recovery, whichever rung answered', () => {
    // The property the single ladder exists to guarantee. A reader seeing
    // "finishes ~X → ready ~Y" can do the subtraction and get the recovery.
    const cases = [
      { schedule: { scheduledDate: DATE, scheduledTime: '14:00' } },
      { schedule: { scheduledDate: DATE, scheduledTime: '14:00', startTime: '14:40' } },
      { schedule: { scheduledDate: DATE, scheduledTime: '14:00', endTime: '15:00' } },
    ];
    for (const schedule of cases) {
      const result: any = analyze({ averageMinutes: 90, recoveryMinutes: 60 }, [target(), upstream(schedule as any)]);
      const dependency = result.findings.find((f: any) => f.kind === 'dependency');
      const toMinutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
      expect(toMinutes(dependency.readyAt) - toMinutes(dependency.notBefore)).toBe(60);
    }
  });

  it('leaves a recovery finding alone — its time already includes recovery', () => {
    // The distinction that makes a blanket "readiness excludes rest" caveat
    // wrong: only a dependency's figure is court-free.
    const earlier: ReadinessMatchUp = {
      matchUpId: 'earlier',
      matchUpType: 'SINGLES',
      sides: [{ participantId: 'p9' }, { participantId: 'p8' }],
      schedule: { scheduledDate: DATE, scheduledTime: '13:00', endTime: '14:00' },
      winningSide: 1,
    };
    const result: any = analyze({ averageMinutes: 90, recoveryMinutes: 60 }, [target(), earlier]);
    const recovery = result.findings.find((f: any) => f.kind === 'recovery');
    expect(recovery.notBefore).toBe('15:00');
    expect(recovery.readyAt).toBeUndefined();
  });
});

describe('earliestStart — what a clock should be seeded with', () => {
  const finding = (over: any) => ({ kind: 'dependency', severity: 'WARN', ...over });

  it('prefers the recovery-inclusive figure over the court-free one', () => {
    // The whole point: a dependency's `notBefore` is when the COURT frees.
    // Seeding a picker with it offers a time the panel says the player cannot
    // make.
    expect(earliestStart([finding({ notBefore: '15:30', readyAt: '16:30' })])).toBe('16:30');
  });

  it('falls back to notBefore when a finding carries no readyAt', () => {
    // A recovery finding's time is already recovery-inclusive; a zero-recovery
    // dependency has nothing to add.
    expect(earliestStart([finding({ kind: 'recovery', notBefore: '15:00' })])).toBe('15:00');
  });

  it('takes the LATEST floor across findings, not the earliest', () => {
    // Each finding is a separate thing in the way; clearing one while another
    // stands is not a start time.
    const findings = [
      finding({ notBefore: '15:30', readyAt: '16:30' }),
      finding({ kind: 'recovery', notBefore: '17:00' }),
    ];
    expect(earliestStart(findings)).toBe('17:00');
  });

  it('compares the recovery-inclusive figures, not the raw ones', () => {
    // A finding whose court-free time is earlier can still carry the latest
    // ready time; sorting on the wrong field would pick the wrong floor.
    const findings = [finding({ notBefore: '15:00', readyAt: '18:00' }), finding({ notBefore: '16:00' })];
    expect(earliestStart(findings)).toBe('18:00');
  });

  it('says nothing when no finding names a time', () => {
    expect(earliestStart([finding({})])).toBeUndefined();
    expect(earliestStart([])).toBeUndefined();
  });
});

describe('what the schedule actually commits to', () => {
  const target = (schedule: any): ReadinessMatchUp => ({
    matchUpId: 'sf',
    matchUpType: 'SINGLES',
    sides: [{ participantId: 'p1' }, { participantId: 'p9' }],
    schedule: { scheduledDate: DATE, ...schedule },
  });
  const earlier = (): ReadinessMatchUp => ({
    matchUpId: 'earlier',
    matchUpType: 'SINGLES',
    sides: [{ participantId: 'p1' }, { participantId: 'p8' }],
    schedule: { scheduledDate: DATE, scheduledTime: '13:00', endTime: '14:00' },
    winningSide: 1,
  });
  const analyze = (t: ReadinessMatchUp) =>
    analyzeMatchUpReadiness({
      matchUpId: 'sf',
      matchUps: [t, earlier()],
      timingFor: () => ({ averageMinutes: 90, recoveryMinutes: 60 }),
    }) as any;

  it('does not grade a time the schedule withdrew', () => {
    // Grading it would have the app contradict its own operator, in red, about
    // a time the schedule never stated.
    const result = analyze(target({ scheduledTime: '14:30', timeModifiers: ['TO_BE_ANNOUNCED'] }));
    expect(result).toEqual({ evaluated: false, reason: 'timeNotPromised' });
  });

  it('still grades a firm time — the control', () => {
    const result = analyze(target({ scheduledTime: '14:30' }));
    expect(result.evaluated).toBe(true);
    expect(result.findings[0]).toMatchObject({ kind: 'recovery', severity: 'WARN' });
  });

  it('demotes findings against a NOT_BEFORE floor to INFO, keeping their times', () => {
    // "No earlier than 14:30" is a floor. A blocker clearing at 15:00 is a
    // LATER floor, not a broken promise — so the panel keeps the sentence and
    // the clock, and the card stops shouting.
    const result = analyze(target({ scheduledTime: '14:30', timeModifiers: ['NOT_BEFORE'] }));
    expect(result.evaluated).toBe(true);
    expect(result.findings[0]).toMatchObject({ kind: 'recovery', severity: 'INFO', notBefore: '15:00' });
  });

  it('never demotes an overlap — a body on a court is not a promise', () => {
    const onCourt: ReadinessMatchUp = {
      matchUpId: 'live',
      matchUpType: 'SINGLES',
      sides: [{ participantId: 'p1' }, { participantId: 'p7' }],
      schedule: { scheduledDate: DATE, scheduledTime: '14:00' },
    };
    const result: any = analyzeMatchUpReadiness({
      matchUpId: 'sf',
      matchUps: [target({ scheduledTime: '14:30', timeModifiers: ['NOT_BEFORE'] }), onCourt],
      timingFor: () => ({ averageMinutes: 90, recoveryMinutes: 60 }),
    });
    expect(result.findings.find((f: any) => f.kind === 'overlap')).toMatchObject({ severity: 'WARN' });
  });
});
