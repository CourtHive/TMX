import { describe, expect, it } from 'vitest';

import { analyzeMatchUpReadiness, individualIds, minutesToClock } from './matchUpReadiness';

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
