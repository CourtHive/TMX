/**
 * Readiness / rest conformance — where the two analyses must agree, and where
 * they must NOT be tidied into agreement.
 *
 * ── Why this file exists ──
 *
 * `matchUpReadiness` and `participantRest` both have to answer, in the middle of
 * their own work, a question about a THIRD matchUp: when does this upstream
 * finish, and when is the player coming out of it free? Readiness renders that
 * as a dependency finding's `finishes ~X → ready ~Y`; rest renders it as the
 * `pendingUpstream` row's `readyAt`. They sit four lines apart in one Inspector
 * panel, so when they disagree the operator sees it.
 *
 * They HAD diverged, in two ways at once. Readiness ran two different ladders
 * over the same matchUp — `scheduledTime` for the finish, `endTime` for the
 * ready figure — so the arrow row did not even reconcile with itself. And its
 * ladder ignored `startTime`, so a feeder that went on forty minutes late was
 * still projected from its plan while rest used the real start.
 *
 * ── The part that must agree ──
 *
 * For the rungs both modules read — a recorded `endTime`, a real `startTime`, a
 * bare `scheduledTime` — the two must produce the same clock. That is what the
 * first block pins.
 *
 * ── The divergence that must NOT be "fixed" ──
 *
 * Rest reads two further rungs, `scoredTime` and `calledAt`, and gates every
 * rung against "now". Readiness reads neither and has no clock at all.
 *
 * That is deliberate on both sides. Rest is anchored on NOW and measures an
 * elapsed interval, so a score stamp is a sound late-biased proxy for a finish
 * and an anchor in the future is unusable by definition. Readiness is anchored
 * on the target's own `scheduledTime` and asks whether a PLAN holds; it must be
 * a function of the record, or two cards rendered a minute apart would grade
 * differently, and the Inspector's time picker would drift while open.
 *
 * It is also what lets readiness run in the factory unchanged — the shipped
 * `getMatchUpReadiness` takes no `asOf` and no time zone, while
 * `getParticipantRest` requires both.
 *
 * A future reader who "consolidates" these by giving readiness rest's ladder
 * would import an instant-to-zone conversion into a clock-free module, and would
 * make a dependency finding VANISH the moment somebody wins a game: rest's
 * `resolveAnchor` takes the first score stamp as the finish, and then withholds
 * the figure once that stamp is behind the clock. The second block pins the
 * boundary so that change fails here first.
 */
import { analyzeMatchUpReadiness } from './matchUpReadiness';
import { analyzeParticipantRest } from './participantRest';
import { describe, expect, it } from 'vitest';

// constants and types
import type { NormalizedTimes, RestTiming } from './participantRest';
import type { ReadinessMatchUp } from './matchUpReadiness';

const DATE = '2026-09-14';
const TIMING: RestTiming = { averageMinutes: 90, recoveryMinutes: 60, typeChangeRecoveryMinutes: 0 };
/**
 * Before every projected finish below, deliberately.
 *
 * Rest withholds `readyAt` once its anchor is behind the clock (`overrun`), so a
 * late `asOf` would make every comparison in the first block read `undefined`
 * and pass for the wrong reason. That suppression is real behaviour and is
 * pinned on purpose in the second block; here it has to be out of the way.
 */
const AS_OF = 14 * 60;

const feeder = (schedule: any): ReadinessMatchUp => ({
  matchUpId: 'qf',
  matchUpType: 'SINGLES',
  winnerMatchUpId: 'sf',
  sides: [{ participantId: 'p1' }, { participantId: 'p2' }],
  schedule: { scheduledDate: DATE, ...schedule },
});

const target = (): ReadinessMatchUp => ({
  matchUpId: 'sf',
  matchUpType: 'SINGLES',
  sides: [{}, { participantId: 'p9' }],
  schedule: { scheduledDate: DATE, scheduledTime: '14:30' },
});

/** Readiness's `readyAt` for the dependency on `qf`. */
function readinessReadyAt(schedule: any): string | undefined {
  const result: any = analyzeMatchUpReadiness({
    matchUpId: 'sf',
    matchUps: [target(), feeder(schedule)],
    timingFor: () => TIMING,
  });
  return result.findings.find((finding: any) => finding.kind === 'dependency')?.readyAt;
}

/** Rest's `readyAt` for the pendingUpstream row standing for the same undecided side. */
function restReadyAt(schedule: any, times: NormalizedTimes): string | undefined {
  const result: any = analyzeParticipantRest({
    matchUpId: 'sf',
    matchUps: [target(), feeder(schedule)],
    scheduledDate: DATE,
    asOfMinutes: AS_OF,
    timingFor: () => TIMING,
    timesFor: () => times,
    dailyLimits: undefined,
  });
  return result.rows.find((row: any) => row.pendingUpstream)?.readyAt;
}

describe('the rungs both modules read must produce the same clock', () => {
  it('agrees on a recorded endTime', () => {
    const schedule = { scheduledTime: '14:00', endTime: '15:00' };
    expect(readinessReadyAt(schedule)).toBe('16:00');
    expect(restReadyAt(schedule, { endMinutes: 15 * 60 })).toBe('16:00');
  });

  it('agrees on a real startTime — the rung readiness used to discard', () => {
    const schedule = { scheduledTime: '14:00', startTime: '14:40' };
    expect(readinessReadyAt(schedule)).toBe('17:10');
    expect(restReadyAt(schedule, { startMinutes: 14 * 60 + 40 })).toBe('17:10');
  });

  it('agrees on a bare scheduledTime', () => {
    const schedule = { scheduledTime: '14:00' };
    expect(readinessReadyAt(schedule)).toBe('16:30');
    expect(restReadyAt(schedule, { scheduledMinutes: 14 * 60 })).toBe('16:30');
  });
});

describe('the divergence that must NOT be "fixed"', () => {
  it('rest reads scoredTime; readiness does not, and must not', () => {
    // Rest anchors on the score stamp — a sound late-biased proxy when measuring
    // an elapsed rest. Readiness has no clock to judge such a stamp against and
    // falls back to the plan, which is the answer a PLAN check should give.
    const schedule = { scheduledTime: '14:00' };
    expect(restReadyAt(schedule, { scoredMinutes: 15 * 60 + 20 })).toBe('16:20');
    expect(readinessReadyAt(schedule)).toBe('16:30');
  });

  it('rest reads calledAt; readiness does not, and must not', () => {
    // `calledAt` is a UTC instant. Reading it needs a viewed date and a venue
    // frame — the conversion apparatus readiness deliberately does without.
    const schedule = { scheduledTime: '14:00' };
    expect(restReadyAt(schedule, { calledMinutes: 14 * 60 + 30 })).toBe('17:00');
    expect(readinessReadyAt(schedule)).toBe('16:30');
  });

  it('readiness still answers where rest goes silent', () => {
    // Rest withholds `readyAt` once its anchor is behind the clock — `overrun`,
    // which is correct for "is this player rested yet" and useless for "does
    // this plan hold". Give readiness rest's ladder and the dependency finding
    // loses its figures exactly when a feeder runs long.
    const schedule = { scheduledTime: '14:00', startTime: '14:40' };
    const early = analyzeParticipantRest({
      matchUpId: 'sf',
      matchUps: [target(), feeder(schedule)],
      scheduledDate: DATE,
      asOfMinutes: 17 * 60, // past the projected finish of 16:10
      timingFor: () => TIMING,
      timesFor: () => ({ startMinutes: 14 * 60 + 40 }),
      dailyLimits: undefined,
    }) as any;
    const pending = early.rows.find((row: any) => row.pendingUpstream);
    expect(pending.overrun).toBe(true);
    expect(pending.readyAt).toBeUndefined();

    // Readiness, clock-free, still names both times.
    expect(readinessReadyAt(schedule)).toBe('17:10');
  });
});
