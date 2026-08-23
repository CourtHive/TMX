import { analyzeParticipantRest, resolveAnchor } from './participantRest';
import { describe, expect, it } from 'vitest';

// constants and types
import type { NormalizedTimes, RestInput, RestTiming } from './participantRest';
import type { ReadinessMatchUp } from './matchUpReadiness';

const DATE = '2026-08-22';
const ALICE = 'p-alice';
const BOB = 'p-bob';
const CHEN = 'p-chen';

const TIMING: RestTiming = { averageMinutes: 90, recoveryMinutes: 60, typeChangeRecoveryMinutes: 30 };
const NOT_EVALUATED = 'expected evaluation';

/** Narrow an evaluated result, failing loudly rather than silently skipping assertions. */
function evaluated(result: ReturnType<typeof analyzeParticipantRest>) {
  if (!result.evaluated) throw new Error(NOT_EVALUATED);
  return result;
}

function singles(params: {
  id: string;
  ids: string[];
  names?: string[];
  status?: string;
  winningSide?: number;
  scheduledTime?: string;
  matchUpType?: string;
  roundName?: string;
}): ReadinessMatchUp {
  const names = params.names ?? params.ids;
  return {
    matchUpId: params.id,
    matchUpStatus: params.status,
    matchUpType: params.matchUpType ?? 'SINGLES',
    roundName: params.roundName,
    winningSide: params.winningSide,
    sides: params.ids.map((participantId, i) => ({ participantId, participantName: names[i] })),
    schedule: { scheduledDate: DATE, scheduledTime: params.scheduledTime },
  };
}

/** Build an input whose `timesFor` reads from an explicit per-matchUp table. */
function buildInput(params: {
  matchUpId: string;
  matchUps: ReadinessMatchUp[];
  times: Record<string, NormalizedTimes>;
  asOfMinutes: number;
  timing?: Record<string, RestTiming>;
  dailyLimits?: RestInput['dailyLimits'];
}): RestInput {
  return {
    matchUpId: params.matchUpId,
    matchUps: params.matchUps,
    scheduledDate: DATE,
    asOfMinutes: params.asOfMinutes,
    timingFor: (matchUp) => params.timing?.[matchUp.matchUpId] ?? TIMING,
    timesFor: (matchUp) => params.times[matchUp.matchUpId] ?? {},
    dailyLimits: params.dailyLimits,
  };
}

describe('resolveAnchor — the precedence ladder', () => {
  it('prefers endTime over every other rung', () => {
    const times: NormalizedTimes = { endMinutes: 720, scoredMinutes: 740, startMinutes: 600, scheduledMinutes: 590 };
    expect(resolveAnchor(times, TIMING)).toEqual({ minutes: 720, source: 'endTime' });
  });

  it('falls back to scoredTime when endTime is absent — the common path', () => {
    const times: NormalizedTimes = { scoredMinutes: 740, startMinutes: 600, scheduledMinutes: 590 };
    expect(resolveAnchor(times, TIMING)).toEqual({ minutes: 740, source: 'scoredTime' });
  });

  it('projects from startTime by averageMinutes when no finish was recorded', () => {
    expect(resolveAnchor({ startMinutes: 600 }, TIMING)).toEqual({ minutes: 690, source: 'startTime' });
  });

  it('projects from calledAt, then from scheduledTime, in that order', () => {
    expect(resolveAnchor({ calledMinutes: 600, scheduledMinutes: 540 }, TIMING)).toEqual({
      minutes: 690,
      source: 'calledAt',
    });
    expect(resolveAnchor({ scheduledMinutes: 540 }, TIMING)).toEqual({ minutes: 630, source: 'scheduledTime' });
  });

  it('returns undefined when the matchUp carries no time at all', () => {
    expect(resolveAnchor({}, TIMING)).toBeUndefined();
  });
});

describe('analyzeParticipantRest — skip reasons', () => {
  const target = singles({ id: 'm2', ids: [ALICE, BOB] });

  it('skips an unknown matchUp', () => {
    const input = buildInput({ matchUpId: 'nope', matchUps: [target], times: {}, asOfMinutes: 800 });
    expect(analyzeParticipantRest(input)).toEqual({ evaluated: false, reason: 'unknownMatchUp' });
  });

  it('skips a BYE and skips a completed matchUp', () => {
    const bye = singles({ id: 'm2', ids: [ALICE], status: 'BYE' });
    const done = singles({ id: 'm2', ids: [ALICE, BOB], winningSide: 1 });
    for (const [matchUp, reason] of [
      [bye, 'bye'],
      [done, 'completed'],
    ] as const) {
      const input = buildInput({ matchUpId: 'm2', matchUps: [matchUp], times: {}, asOfMinutes: 800 });
      expect(analyzeParticipantRest(input)).toEqual({ evaluated: false, reason });
    }
  });

  it('skips when no participant is assigned yet', () => {
    const empty: ReadinessMatchUp = { matchUpId: 'm2', sides: [{}, {}], schedule: { scheduledDate: DATE } };
    const input = buildInput({ matchUpId: 'm2', matchUps: [empty], times: {}, asOfMinutes: 800 });
    expect(analyzeParticipantRest(input)).toEqual({ evaluated: false, reason: 'noParticipants' });
  });

  it('EVALUATES an unscheduled matchUp — the case readiness skips', () => {
    const unscheduled: ReadinessMatchUp = {
      matchUpId: 'm2',
      matchUpType: 'SINGLES',
      sides: [{ participantId: ALICE }, { participantId: BOB }],
      schedule: null,
    };
    const input = buildInput({ matchUpId: 'm2', matchUps: [unscheduled], times: {}, asOfMinutes: 800 });
    const result = analyzeParticipantRest(input);
    expect(result.evaluated).toBe(true);
  });
});

describe('analyzeParticipantRest — rest arithmetic', () => {
  it('measures rest from endTime and reports the source', () => {
    const prior = singles({ id: 'm1', ids: [ALICE, CHEN], winningSide: 1, roundName: 'R32' });
    const target = singles({ id: 'm2', ids: [ALICE, BOB] });
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [prior, target],
      times: { m1: { endMinutes: 726 } }, // 12:06
      asOfMinutes: 860, // 14:20
    });

    const result = evaluated(analyzeParticipantRest(input));
    const alice = result.rows.find((row) => row.participantId === ALICE);
    expect(alice).toMatchObject({
      status: 'rested',
      restMinutes: 134,
      requiredMinutes: 60,
      source: 'endTime',
      fromMatchUpId: 'm1',
      fromMatchUpLabel: 'R32: p-alice vs p-chen',
    });
    expect(alice?.readyAt).toBeUndefined();
  });

  it('reports resting with a readyAt when the requirement is not yet met', () => {
    const prior = singles({ id: 'm1', ids: [ALICE, CHEN], winningSide: 1 });
    const target = singles({ id: 'm2', ids: [ALICE, BOB] });
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [prior, target],
      times: { m1: { scoredMinutes: 828 } }, // 13:48
      asOfMinutes: 860, // 14:20
    });

    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.find((row) => row.participantId === ALICE)).toMatchObject({
      status: 'resting',
      restMinutes: 32,
      requiredMinutes: 60,
      readyAt: '14:48',
      source: 'scoredTime',
    });
  });

  it('reports "none" for a participant with no prior match today', () => {
    const target = singles({ id: 'm2', ids: [ALICE, BOB] });
    const input = buildInput({ matchUpId: 'm2', matchUps: [target], times: {}, asOfMinutes: 860 });
    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.every((row) => row.status === 'none')).toBe(true);
    expect(result.rows[0].restMinutes).toBeUndefined();
    expect(result.rows[0].source).toBeUndefined();
  });

  it('ignores a prior match on a different day', () => {
    const prior = singles({ id: 'm1', ids: [ALICE, CHEN], winningSide: 1 });
    prior.schedule = { scheduledDate: '2026-08-21' };
    const target = singles({ id: 'm2', ids: [ALICE, BOB] });
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [prior, target],
      times: { m1: { endMinutes: 726 } },
      asOfMinutes: 860,
    });
    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.find((row) => row.participantId === ALICE)?.status).toBe('none');
  });

  it('measures from the MOST RECENT of several prior matches', () => {
    const early = singles({ id: 'm0', ids: [ALICE, BOB], winningSide: 1 });
    const late = singles({ id: 'm1', ids: [ALICE, CHEN], winningSide: 1 });
    const target = singles({ id: 'm2', ids: [ALICE, BOB] });
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [early, late, target],
      times: { m0: { endMinutes: 600 }, m1: { endMinutes: 726 } },
      asOfMinutes: 860,
    });
    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.find((row) => row.participantId === ALICE)).toMatchObject({
      restMinutes: 134,
      fromMatchUpId: 'm1',
    });
  });
});

describe('analyzeParticipantRest — on court', () => {
  it('reports onCourt with no rest figure when the prior match is still running', () => {
    const live = singles({ id: 'm1', ids: [ALICE, CHEN], status: 'IN_PROGRESS', roundName: 'R16' });
    const target = singles({ id: 'm2', ids: [ALICE, BOB] });
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [live, target],
      times: { m1: { startMinutes: 810 } }, // 13:30, avg 90 → runs to 15:00
      asOfMinutes: 860, // 14:20
    });

    const result = evaluated(analyzeParticipantRest(input));
    const alice = result.rows.find((row) => row.participantId === ALICE);
    expect(alice).toMatchObject({ status: 'onCourt', readyAt: '16:00', fromMatchUpLabel: 'R16: p-alice vs p-chen' });
    expect(alice?.restMinutes).toBeUndefined();
  });

  it('orders rows worst-first: onCourt, resting, rested, none', () => {
    const liveForAlice = singles({ id: 'm1', ids: [ALICE, 'x'], status: 'IN_PROGRESS' });
    const restingForBob = singles({ id: 'm2', ids: [BOB, 'y'], winningSide: 1 });
    const restedForChen = singles({ id: 'm3', ids: [CHEN, 'z'], winningSide: 1 });
    const target: ReadinessMatchUp = {
      matchUpId: 'm4',
      matchUpType: 'DOUBLES',
      sides: [
        { participantId: 'pairA', participant: { individualParticipantIds: [ALICE, BOB] } },
        { participantId: 'pairB', participant: { individualParticipantIds: [CHEN, 'p-dana'] } },
      ],
      schedule: { scheduledDate: DATE },
    };
    const input = buildInput({
      matchUpId: 'm4',
      matchUps: [liveForAlice, restingForBob, restedForChen, target],
      times: { m1: { startMinutes: 810 }, m2: { endMinutes: 840 }, m3: { endMinutes: 600 } },
      asOfMinutes: 860,
      // Same-type recovery so the DOUBLES target doesn't pull the type-change figure.
      timing: { m1: TIMING, m2: TIMING, m3: TIMING },
    });

    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.map((row) => row.status)).toEqual(['onCourt', 'resting', 'rested', 'none']);
  });
});

describe('analyzeParticipantRest — type-change recovery', () => {
  it('uses typeChangeRecoveryMinutes when the participant switches singles → doubles', () => {
    const prior = singles({ id: 'm1', ids: [ALICE, CHEN], winningSide: 1, matchUpType: 'SINGLES' });
    const target = singles({ id: 'm2', ids: [ALICE, BOB], matchUpType: 'DOUBLES' });
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [prior, target],
      times: { m1: { endMinutes: 820 } },
      asOfMinutes: 860,
    });
    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.find((row) => row.participantId === ALICE)).toMatchObject({
      requiredMinutes: 30,
      typeChange: true,
      status: 'rested',
    });
  });

  it('keeps the plain recovery figure when the type is unchanged', () => {
    const prior = singles({ id: 'm1', ids: [ALICE, CHEN], winningSide: 1 });
    const target = singles({ id: 'm2', ids: [ALICE, BOB] });
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [prior, target],
      times: { m1: { endMinutes: 820 } },
      asOfMinutes: 860,
    });
    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.find((row) => row.participantId === ALICE)).toMatchObject({
      requiredMinutes: 60,
      typeChange: false,
      status: 'resting',
    });
  });
});

describe('analyzeParticipantRest — daily load', () => {
  const priorA = singles({ id: 'm1', ids: [ALICE, CHEN], winningSide: 1 });
  const priorB = singles({ id: 'm0', ids: [ALICE, BOB], winningSide: 1 });
  const target = singles({ id: 'm2', ids: [ALICE, 'p-dana'] });

  it('counts begun matches and reports the ordinal the inspected matchUp would take', () => {
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [priorA, priorB, target],
      times: { m0: { endMinutes: 600 }, m1: { endMinutes: 726 } },
      asOfMinutes: 860,
    });
    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.find((row) => row.participantId === ALICE)?.load).toMatchObject({
      singles: 2,
      doubles: 0,
      total: 2,
      ordinal: 3,
      atLimit: [],
    });
  });

  it('flags the total limit when the inspected matchUp reaches it', () => {
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [priorA, priorB, target],
      times: { m0: { endMinutes: 600 }, m1: { endMinutes: 726 } },
      asOfMinutes: 860,
      dailyLimits: { SINGLES: 2, DOUBLES: 2, total: 3 },
    });
    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.find((row) => row.participantId === ALICE)?.load).toMatchObject({
      ordinal: 3,
      atLimit: ['total', 'singles'],
      limit: 3,
    });
  });

  it('reports no limits at all when none are configured — never substitutes a default', () => {
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [priorA, priorB, target],
      times: { m0: { endMinutes: 600 }, m1: { endMinutes: 726 } },
      asOfMinutes: 860,
    });
    const result = evaluated(analyzeParticipantRest(input));
    const load = result.rows.find((row) => row.participantId === ALICE)?.load;
    expect(load?.atLimit).toEqual([]);
    expect(load?.limit).toBeUndefined();
  });

  it('counts a match that is under way, not just finished ones', () => {
    const live = singles({ id: 'm1', ids: [ALICE, CHEN], status: 'IN_PROGRESS' });
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [live, target],
      times: { m1: { startMinutes: 810 } },
      asOfMinutes: 860,
    });
    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.find((row) => row.participantId === ALICE)?.load).toMatchObject({ total: 1, ordinal: 2 });
  });

  it('does NOT count a match that has not started yet', () => {
    const later = singles({ id: 'm1', ids: [ALICE, CHEN], scheduledTime: '18:00' });
    const input = buildInput({
      matchUpId: 'm2',
      matchUps: [later, target],
      times: { m1: { scheduledMinutes: 1080 } },
      asOfMinutes: 860,
    });
    const result = evaluated(analyzeParticipantRest(input));
    expect(result.rows.find((row) => row.participantId === ALICE)?.load).toMatchObject({ total: 0, ordinal: 1 });
  });
});

// ── Regressions: five defects found by source read 2026-08-23 ────────────────
// Every one of these fails open — it reports a player as freer than they are —
// which is the direction that gets a tired player called to court.

describe('a match that overruns its average duration still occupies the player', () => {
  /**
   * The original `isUnderWay` bounded "under way" at `start + averageMinutes`,
   * so a 90-minute-average match still unscored at three hours was neither
   * finished nor under way and was dropped from the analysis entirely. The
   * player read "No prior match today" while standing on court.
   */
  const target = singles({ id: 'm-next', ids: [ALICE, BOB] });
  const running = singles({ id: 'm-running', ids: [ALICE, CHEN], scheduledTime: '10:00' });

  it('reports onCourt three hours into a 90-minute-average match', () => {
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, running],
          times: { 'm-running': { startMinutes: 600 } },
          asOfMinutes: 780, // 13:00 — 180 minutes in, twice the 90-minute average
        }),
      ),
    );
    const alice = result.rows.find((row) => row.participantId === ALICE);
    expect(alice?.status).toBe('onCourt');
    expect(alice?.fromMatchUpId).toBe('m-running');
  });

  it('withholds readyAt once the projected finish has already passed, rather than naming a time in the past', () => {
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, running],
          times: { 'm-running': { startMinutes: 600 } },
          asOfMinutes: 780,
        }),
      ),
    );
    const alice = result.rows.find((row) => row.participantId === ALICE);
    expect(alice?.readyAt).toBeUndefined();
    expect(alice?.overrun).toBe(true);
  });

  it('still projects readyAt while the match is inside its expected duration', () => {
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, running],
          times: { 'm-running': { startMinutes: 600 } },
          asOfMinutes: 660, // 11:00 — one hour in, still under the 90-minute average
        }),
      ),
    );
    const alice = result.rows.find((row) => row.participantId === ALICE);
    expect(alice).toMatchObject({ status: 'onCourt', readyAt: '12:30' });
    expect(alice?.overrun).toBeUndefined();
  });
});

describe('a completed matchUp with no scheduledDate is dated by its scoredTime', () => {
  /**
   * Scores entered from the draw view leave no `schedule.scheduledDate`, so the
   * day filter discarded them and the player read as unplayed. `scoredTime` is a
   * full instant and already normalizes to minutes-from-viewed-midnight, so a
   * stamp from another day lands outside `0..1439` and dates the match for free.
   */
  const target = singles({ id: 'm-next', ids: [ALICE, BOB] });

  function undated(id: string, ids: string[]): ReadinessMatchUp {
    return { ...singles({ id, ids, status: 'COMPLETED', winningSide: 1 }), schedule: {} };
  }

  it('counts an undated completed match whose scoredTime falls on the viewed day', () => {
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, undated('m-undated', [ALICE, CHEN])],
          times: { 'm-undated': { scoredMinutes: 700 } },
          asOfMinutes: 800,
        }),
      ),
    );
    const alice = result.rows.find((row) => row.participantId === ALICE);
    expect(alice).toMatchObject({ status: 'rested', restMinutes: 100, source: 'scoredTime' });
  });

  it('does NOT count an undated match whose scoredTime belongs to another day', () => {
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, undated('m-yesterday', [ALICE, CHEN])],
          times: { 'm-yesterday': { scoredMinutes: -220 } }, // 20:20 the previous evening
          asOfMinutes: 800,
        }),
      ),
    );
    expect(result.rows.find((row) => row.participantId === ALICE)?.status).toBe('none');
  });

  it('does NOT count an undated match that cannot be dated at all', () => {
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, undated('m-nodate', [ALICE, CHEN])],
          times: { 'm-nodate': { startMinutes: 600 } },
          asOfMinutes: 800,
        }),
      ),
    );
    expect(result.rows.find((row) => row.participantId === ALICE)?.status).toBe('none');
  });
});

describe('a walkover is not a match played', () => {
  const target = singles({ id: 'm-next', ids: [ALICE, BOB] });

  function priorWith(status: string, score?: Record<string, unknown>): ReadinessMatchUp {
    return { ...singles({ id: 'm-prior', ids: [ALICE, CHEN], status, winningSide: 1 }), score };
  }

  it.each(['WALKOVER', 'DOUBLE_WALKOVER'])('charges no recovery for a %s', (status) => {
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, priorWith(status)],
          times: { 'm-prior': { endMinutes: 700 } },
          asOfMinutes: 720,
        }),
      ),
    );
    const alice = result.rows.find((row) => row.participantId === ALICE);
    expect(alice?.status).toBe('none');
    expect(alice?.load.ordinal).toBe(1);
  });

  it('charges no recovery for a DEFAULTED with no score — a no-show never took the court', () => {
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, priorWith('DEFAULTED')],
          times: { 'm-prior': { endMinutes: 700 } },
          asOfMinutes: 720,
        }),
      ),
    );
    expect(result.rows.find((row) => row.participantId === ALICE)?.status).toBe('none');
  });

  it('DOES charge recovery for a DEFAULTED that carries a score — they played before being defaulted', () => {
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, priorWith('DEFAULTED', { sets: [{ side1Score: 6, side2Score: 4 }] })],
          times: { 'm-prior': { endMinutes: 700 } },
          asOfMinutes: 720,
        }),
      ),
    );
    const alice = result.rows.find((row) => row.participantId === ALICE);
    expect(alice).toMatchObject({ status: 'resting', restMinutes: 20 });
  });

  it('DOES charge recovery for a RETIRED — a retirement means they played', () => {
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, priorWith('RETIRED', { sets: [{ side1Score: 6, side2Score: 1 }] })],
          times: { 'm-prior': { endMinutes: 700 } },
          asOfMinutes: 720,
        }),
      ),
    );
    expect(result.rows.find((row) => row.participantId === ALICE)?.status).toBe('resting');
  });
});

describe('an anchor projected into the future is never read as rest already taken', () => {
  /**
   * A finished match with no recorded finish falls to `scheduledTime + average`,
   * which can land after "now". `Math.max(0, …)` then produced `0m of 60m —
   * ready 16:20` for a player who was not tired at all. Prefer an anchor that is
   * actually in the past; when none exists, report zero rest rather than a
   * fictional figure, and say the anchor is unreliable.
   */
  const target = singles({ id: 'm-next', ids: [ALICE, BOB] });

  it('prefers the latest anchor at or before now over a later one in the future', () => {
    const early = singles({ id: 'm-early', ids: [ALICE, CHEN], status: 'COMPLETED', winningSide: 1 });
    const future = singles({ id: 'm-future', ids: [ALICE, CHEN], status: 'COMPLETED', winningSide: 1 });
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, early, future],
          times: { 'm-early': { endMinutes: 600 }, 'm-future': { scheduledMinutes: 900 } },
          asOfMinutes: 780, // 13:00; m-future projects to 16:30
        }),
      ),
    );
    const alice = result.rows.find((row) => row.participantId === ALICE);
    expect(alice).toMatchObject({ status: 'rested', restMinutes: 180, fromMatchUpId: 'm-early' });
  });

  it('reports zero rest and flags the anchor when every anchor is in the future', () => {
    const future = singles({ id: 'm-future', ids: [ALICE, CHEN], status: 'COMPLETED', winningSide: 1 });
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, future],
          times: { 'm-future': { scheduledMinutes: 900 } },
          asOfMinutes: 780,
        }),
      ),
    );
    const alice = result.rows.find((row) => row.participantId === ALICE);
    expect(alice).toMatchObject({ status: 'resting', restMinutes: 0, anchorUnreliable: true });
    expect(alice?.readyAt).toBeUndefined();
  });
});

describe('rows are ordered by how far short of ready they are, not by side order', () => {
  /**
   * The badge takes the head of the worst band. Sorting by band alone left the
   * within-band order as `individualIds` side order, so a doubles pair resting
   * at 10m and 40m badged whichever happened to be listed first.
   */
  function doubles(id: string, pairs: string[][], overrides: Partial<ReadinessMatchUp> = {}): ReadinessMatchUp {
    return {
      matchUpId: id,
      matchUpType: 'DOUBLES',
      sides: pairs.map((individualParticipantIds, i) => ({
        participantId: `pair-${id}-${i}`,
        participant: { participantId: `pair-${id}-${i}`, individualParticipantIds },
      })),
      schedule: { scheduledDate: DATE },
      ...overrides,
    };
  }

  it('puts the participant furthest from ready first within the resting band', () => {
    const target = doubles('m-next', [
      [ALICE, BOB],
      [CHEN, 'p-dana'],
    ]);
    const alicePrior = doubles(
      'm-a',
      [
        [ALICE, 'p-x'],
        ['p-y', 'p-z'],
      ],
      { matchUpStatus: 'COMPLETED', winningSide: 1 },
    );
    const bobPrior = doubles(
      'm-b',
      [
        [BOB, 'p-x'],
        ['p-y', 'p-z'],
      ],
      { matchUpStatus: 'COMPLETED', winningSide: 1 },
    );

    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, alicePrior, bobPrior],
          // Alice finished at 12:00 (40m ago), Bob at 12:30 (10m ago) — Bob is worse off.
          times: { 'm-a': { endMinutes: 720 }, 'm-b': { endMinutes: 750 } },
          asOfMinutes: 760,
        }),
      ),
    );
    const resting = result.rows.filter((row) => row.status === 'resting');
    expect(resting.map((row) => row.participantId)).toEqual([BOB, ALICE]);
  });
});

describe('the DOUBLES daily limit, whose SINGLES twin was already covered', () => {
  /** A doubles matchUp counted against `DOUBLES` rather than `SINGLES`, in its own right. */
  function pair(id: string, individuals: string[], overrides: Partial<ReadinessMatchUp> = {}): ReadinessMatchUp {
    return {
      matchUpId: id,
      matchUpType: 'DOUBLES',
      sides: [
        {
          participantId: `pair-${id}`,
          participant: { participantId: `pair-${id}`, individualParticipantIds: individuals },
        },
        {
          participantId: `opp-${id}`,
          participant: { participantId: `opp-${id}`, individualParticipantIds: ['p-x', 'p-y'] },
        },
      ],
      schedule: { scheduledDate: DATE },
      ...overrides,
    };
  }

  it('flags a participant who would meet the DOUBLES limit', () => {
    const target = pair('m-next', [ALICE, BOB]);
    const played = pair('m-done', [ALICE, CHEN], { matchUpStatus: 'COMPLETED', winningSide: 1 });
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, played],
          times: { 'm-done': { endMinutes: 600 } },
          asOfMinutes: 800,
          dailyLimits: { DOUBLES: 2 },
        }),
      ),
    );
    expect(result.rows.find((row) => row.participantId === ALICE)?.load).toMatchObject({
      doubles: 1,
      ordinal: 2,
      atLimit: ['doubles'],
      limit: 2,
    });
  });

  it('does NOT flag a participant still below the DOUBLES limit', () => {
    const target = pair('m-next', [ALICE, BOB]);
    const played = pair('m-done', [ALICE, CHEN], { matchUpStatus: 'COMPLETED', winningSide: 1 });
    const result = evaluated(
      analyzeParticipantRest(
        buildInput({
          matchUpId: 'm-next',
          matchUps: [target, played],
          times: { 'm-done': { endMinutes: 600 } },
          asOfMinutes: 800,
          dailyLimits: { DOUBLES: 3 },
        }),
      ),
    );
    expect(result.rows.find((row) => row.participantId === ALICE)?.load.atLimit).toEqual([]);
  });
});
