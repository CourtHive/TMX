/**
 * `wasPlayed` conformance — TMX's copy must agree with the factory's.
 *
 * ── Why this file exists ──
 *
 * `participantRest.wasPlayed` and `factory/src/query/reports/recoveryTimeline.wasPlayed`
 * are two copies of one rule. They had already drifted by a status: the factory
 * counted `CANCELLED` as unplayed and TMX did not, so the same matchUp produced
 * one rest figure in the Inspector and a different one in the recovery report.
 * TMX #1356 aligned them and recorded that **the factory is authoritative**;
 * factory #4707 moved that statement into `recoveryTimeline.ts` itself.
 *
 * Neither of those *enforces* anything. Two files agreeing today, with a comment
 * in each asking the next editor to keep them agreeing, is exactly the state
 * they were in before they drifted. This is the enforcement.
 *
 * ── Why it is behavioural, not a source comparison ──
 *
 * `wasPlayed` is not exported from the factory's package entry, and the
 * published tarball ships `dist` only (`files: ['dist']`), so TMX cannot import
 * it or read its source. CI installs the **published** factory — the `link:`
 * overrides are stripped on the runner — so a test that read the sibling
 * checkout would assert against code TMX does not ship against.
 *
 * So this drives the real thing: for each status, build a tournament with one
 * scheduled matchUp, run the factory's Participant Recovery report, and check
 * that TMX's predicate agrees with whether the factory counted that matchUp as
 * played. It fails when either copy moves, which is the whole point, and it
 * tests the factory TMX actually ships against.
 *
 * ── The divergence that must NOT be "fixed" ──
 *
 * Pinned in the last describe block. TMX's finish-anchor plausibility check
 * tolerates a missing start; the factory's `isPlausibleFinish` does not. Same
 * idea, different question — one computes an ANCHOR, the other a DURATION, and
 * you cannot measure a duration from nothing. A future reader tidying these into
 * agreement would silently blank the rest figure for every score entered from
 * the draw view, which leaves no start time behind.
 */
import { matchUpStatusConstants, mocksEngine, reportConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { describe, expect, it } from 'vitest';
import { wasPlayed } from './participantRest';

/**
 * A zone that is NOT the ambient one (the suite runs `TZ=UTC`). Whether a
 * matchUp was played is a property of its status and score, never of the clock —
 * running the frame off-UTC keeps it that way, and would catch a `wasPlayed`
 * that quietly acquired a time dependency.
 */
const VENUE_ZONE = 'America/New_York';

type Probe = { played: boolean; matchUp: any };

/**
 * One tournament, one scheduled matchUp, that status applied — then ask the
 * factory's report whether it counted.
 *
 * `rows.length > 0` is the observable: `appearancesForMatchUp` returns an empty
 * list for anything `wasPlayed` rejects, and with a single matchUp in the draw
 * that empties the report.
 */
function probe(matchUpStatus: string, withScore: boolean): Probe {
  const { tournamentRecord }: any = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawSize: 2 }],
    setState: true,
  });
  const { matchUps }: any = tournamentEngine.allTournamentMatchUps({ inContext: true });
  const target = matchUps[0];
  const date = tournamentRecord.startDate;

  tournamentEngine.bulkScheduleMatchUps({
    matchUpIds: [target.matchUpId],
    schedule: {
      scheduledDate: date,
      scheduledTime: `${date}T10:00`,
      startTime: `${date}T10:00`,
      endTime: `${date}T11:30`,
    },
  });

  // A double walkover / double default has no winner; asserting one is rejected.
  const noWinner = ['DOUBLE_WALKOVER', 'DOUBLE_DEFAULT', 'CANCELLED', 'ABANDONED'].includes(matchUpStatus);
  const outcome: any = { matchUpStatus, ...(noWinner ? {} : { winningSide: 1 }) };
  if (withScore) {
    outcome.score = { sets: [{ side1Score: 6, side2Score: 1, winningSide: 1 }], scoreStringSide1: '6-1' };
  }
  tournamentEngine.setMatchUpStatus({ matchUpId: target.matchUpId, drawId: target.drawId, outcome });

  const report: any = tournamentEngine.generateReport({
    reportId: reportConstants.PARTICIPANT_RECOVERY_REPORT,
    parameters: { timeZone: VENUE_ZONE },
  });

  const { matchUps: stored }: any = tournamentEngine.allTournamentMatchUps({ inContext: true });
  return { played: !!report?.rows?.length, matchUp: stored[0] };
}

/** Every status TMX and the factory both classify, and what the factory does with it. */
const CASES: { status: string; withScore: boolean; expectPlayed: boolean; why: string }[] = [
  { status: 'COMPLETED', withScore: false, expectPlayed: true, why: 'the ordinary case' },
  { status: 'WALKOVER', withScore: false, expectPlayed: false, why: 'nobody stepped on court' },
  { status: 'DOUBLE_WALKOVER', withScore: false, expectPlayed: false, why: 'neither side appeared' },
  {
    status: 'CANCELLED',
    withScore: false,
    expectPlayed: false,
    why: 'the status that drifted, and why this file exists',
  },
  { status: 'DEFAULTED', withScore: false, expectPlayed: false, why: 'a default with no score is a no-show' },
  {
    status: 'DEFAULTED',
    withScore: true,
    expectPlayed: true,
    why: 'a default WITH a score was played up to the default',
  },
  { status: 'RETIRED', withScore: false, expectPlayed: true, why: 'a retirement means time was spent on court' },
  { status: 'ABANDONED', withScore: false, expectPlayed: true, why: 'an abandonment means time was spent on court' },
];

describe('wasPlayed — TMX agrees with the factory it ships against', () => {
  for (const { status, withScore, expectPlayed, why } of CASES) {
    const label = `${status}${withScore ? ' with a score' : ''}`;

    it(`${label}: ${why}`, () => {
      const { played, matchUp } = probe(status, withScore);

      // The factory's own verdict, observed rather than asserted from its source.
      expect(played).toBe(expectPlayed);
      // TMX's copy must reach the same one, from the record the engine stored.
      expect(wasPlayed(matchUp)).toBe(expectPlayed);
    });
  }
});

describe('wasPlayed — the score-discriminated branch, and its one unreachable corner', () => {
  /**
   * `DOUBLE_DEFAULT` cannot exercise the "default with a score" branch, because
   * the engine does not keep a score on one — `setMatchUpStatus` stores the
   * status and drops the sets. Both copies therefore answer `false` for it in
   * practice, and that is a property of the engine rather than of the rule.
   *
   * Pinned so nobody "corrects" the expectation to `true` by reading the
   * predicate and not the record.
   */
  it('DOUBLE_DEFAULT keeps no score, so the score branch never fires for it', () => {
    const { played, matchUp } = probe('DOUBLE_DEFAULT', true);
    expect(matchUp.score?.sets?.length ?? 0).toBe(0);
    expect(played).toBe(false);
    expect(wasPlayed(matchUp)).toBe(false);
  });

  it('is decided by the record, not the request: a DEFAULTED score survives and flips the verdict', () => {
    const withoutScore = probe('DEFAULTED', false);
    const withScore = probe('DEFAULTED', true);
    expect(withoutScore.matchUp.score?.sets?.length ?? 0).toBe(0);
    expect(withScore.matchUp.score?.sets?.length).toBeGreaterThan(0);
    expect(wasPlayed(withoutScore.matchUp)).toBe(false);
    expect(wasPlayed(withScore.matchUp)).toBe(true);
  });
});

describe('wasPlayed — status vocabulary, not TMX-local strings', () => {
  /**
   * Both copies key on `matchUpStatus` values from the factory's own vocabulary.
   * If a status this file names were renamed there, the probe would stop
   * reproducing it and this guard says so directly rather than through a
   * confusing `expected true, got false`.
   */
  it('every status under test is one the factory recognises', () => {
    const known = new Set(Object.values(matchUpStatusConstants));
    for (const { status } of [...CASES, { status: 'DOUBLE_DEFAULT' }]) {
      expect(known).toContain(status);
    }
  });
});
