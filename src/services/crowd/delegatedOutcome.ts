/**
 * delegatedOutcome — pure helpers for the record-entry half of crowd-sourced
 * scoring (Phase D).
 *
 * A nominated crowd scorer's live score does NOT enter the tournament record
 * automatically. When the TD elects to record it, TMX writes it onto the
 * matchUp as a `delegatedOutcome` (factory `setDelegatedOutcome` — no factory
 * change). The delegated outcome carries the scorer's identity as provenance.
 * On final confirmation the TD promotes it to the official score
 * (`setMatchUpStatus`) and clears it (`removeDelegatedOutcome`).
 *
 * The outcome stays in the canonical shape (`score.sets` + winningSide); the
 * factory's `setDelegatedOutcome` accepts that directly and derives any per-side
 * score strings internally — no caller-side string round-tripping.
 */

import { classifyScorer, type ScorerClassification } from './classifyScorer';

import { REMOVE_DELEGATED_OUTCOME, SET_DELEGATED_OUTCOME, SET_MATCHUP_STATUS } from 'constants/mutationConstants';

export interface DelegatedOutcomeScorer {
  personId: string | null;
  displayName?: string;
}

export interface DelegatedOutcome {
  score?: any;
  matchUpStatus?: string;
  winningSide?: number;
  /** Provenance — who supplied this (non-official) score. */
  scorer?: DelegatedOutcomeScorer;
}

/** Read a matchUp's delegatedOutcome whether stored first-class or as an extension. */
export function readDelegatedOutcome(matchUp: any): DelegatedOutcome | undefined {
  if (!matchUp) return undefined;
  // inContext matchUps surface the extension as `_delegatedOutcome`; a first-class
  // attribute is `delegatedOutcome`; raw records carry it under `extensions[]`.
  if (matchUp._delegatedOutcome) return matchUp._delegatedOutcome as DelegatedOutcome;
  if (matchUp.delegatedOutcome) return matchUp.delegatedOutcome as DelegatedOutcome;
  const ext = (matchUp.extensions ?? []).find((e: any) => e?.name === 'delegatedOutcome');
  return ext?.value as DelegatedOutcome | undefined;
}

/**
 * Assemble the canonical `outcome` for `setDelegatedOutcome` and attach scorer
 * provenance. The score stays canonical (`{ sets }`); the factory derives any
 * per-side score strings internally.
 */
export function buildDelegatedOutcome(args: {
  score?: any;
  matchUpStatus?: string;
  winningSide?: number;
  scorer: DelegatedOutcomeScorer;
}): DelegatedOutcome {
  return {
    score: args.score,
    matchUpStatus: args.matchUpStatus,
    winningSide: args.winningSide,
    scorer: args.scorer,
  };
}

/** Map a relay crowd snapshot's sets to the TODS score `sets` shape. */
export function snapshotToSets(snapshot: any): any[] {
  const sets = snapshot?.sets ?? [];
  return sets.map((s: any) => ({
    setNumber: s.setNumber,
    side1Score: s.side1Score,
    side2Score: s.side2Score,
    side1TiebreakScore: s.side1TiebreakScore,
    side2TiebreakScore: s.side2TiebreakScore,
    winningSide: s.winningSide,
  }));
}

/**
 * The two methods that promote a delegated outcome to the official score and
 * clear the delegated marker. Pure, so it is unit-testable apart from dispatch.
 */
export function buildConfirmMethods(args: { matchUpId: string; drawId: string; delegatedOutcome: any }): any[] {
  const { matchUpId, drawId, delegatedOutcome } = args;
  return [
    {
      method: SET_MATCHUP_STATUS,
      params: {
        matchUpId,
        drawId,
        outcome: {
          score: delegatedOutcome?.score,
          winningSide: delegatedOutcome?.winningSide,
          matchUpStatus: delegatedOutcome?.matchUpStatus,
        },
      },
    },
    { method: REMOVE_DELEGATED_OUTCOME, params: { matchUpId, drawId } },
  ];
}

/** Whether a crowd session's snapshot represents a completed match. */
export function sessionIsComplete(session: any): boolean {
  const score = session?.currentScore;
  return score?.winningSide != null || score?.matchUpStatus === 'COMPLETED';
}

/**
 * One-click Accept (Phase D) for a trusted (nominated/role scorekeeper or
 * official) + verified session on a COMPLETED match: the methods that write the
 * scorer's final score as a delegated outcome and immediately promote it to the
 * official score. Returns [] when the session is not yet complete — Accept then
 * only promotes the live feed (handled by the flow layer). Pure.
 */
export function buildAcceptMethods(args: { session: any; matchUpId: string; drawId: string }): any[] {
  const { session, matchUpId, drawId } = args;
  if (!sessionIsComplete(session)) return [];
  const delegated = buildDelegatedOutcome({
    score: { sets: snapshotToSets(session?.currentScore) },
    matchUpStatus: session?.currentScore?.matchUpStatus,
    winningSide: session?.currentScore?.winningSide,
    scorer: { personId: session?.crowdScoredBy?.personId ?? null, displayName: session?.crowdScoredBy?.displayName },
  });
  return [
    { method: SET_DELEGATED_OUTCOME, params: { matchUpId, drawId, outcome: delegated } },
    ...buildConfirmMethods({ matchUpId, drawId, delegatedOutcome: delegated }),
  ];
}

export interface ReconciliationIssue {
  matchUpId: string;
  scorer: DelegatedOutcomeScorer | undefined;
  classification: ScorerClassification;
}

/**
 * The reconciliation flag: completed matchUps that still carry a
 * `delegatedOutcome` whose scorekeeper is NOT a tournament participant/official.
 * These need the TD's final sign-off (confirm → official + clear).
 *
 * A delegated outcome from a participant/official scorekeeper is not flagged —
 * only crowd / anonymous provenance on a finalized matchUp.
 */
/**
 * Single-matchUp reconciliation check (for a per-cell badge): returns an issue
 * when a completed matchUp still carries a `delegatedOutcome` whose scorekeeper
 * is NOT a tournament participant/official, else undefined.
 */
export function matchUpDelegationIssue(matchUp: any, participants: any[]): ReconciliationIssue | undefined {
  const delegated = readDelegatedOutcome(matchUp);
  if (!delegated) return undefined;
  // Only flag once the matchUp has an official outcome (a winningSide).
  const completed = matchUp?.winningSide != null || matchUp?.matchUpStatus === 'COMPLETED';
  if (!completed) return undefined;

  const personId = delegated.scorer?.personId ?? null;
  const { classification } = classifyScorer({ participants, personId });
  if (classification === 'crowd' || classification === 'anonymous') {
    return { matchUpId: matchUp.matchUpId, scorer: delegated.scorer, classification };
  }
  return undefined;
}

export function findDelegatedReconciliationIssues(args: {
  matchUps: any[];
  participants: any[];
}): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  for (const matchUp of args?.matchUps ?? []) {
    const issue = matchUpDelegationIssue(matchUp, args?.participants ?? []);
    if (issue) issues.push(issue);
  }
  return issues;
}
