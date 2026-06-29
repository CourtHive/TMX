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
 * The factory stores the outcome opaquely but VALIDATES that
 * `outcome.score.scoreStringSide1` and `scoreStringSide2` are present, so the
 * assembler requires them.
 */

import { classifyScorer, type ScorerClassification } from './classifyScorer';

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
  if (matchUp.delegatedOutcome) return matchUp.delegatedOutcome as DelegatedOutcome;
  const ext = (matchUp.extensions ?? []).find((e: any) => e?.name === 'delegatedOutcome');
  return ext?.value as DelegatedOutcome | undefined;
}

/**
 * Assemble the `outcome` for `setDelegatedOutcome`, guaranteeing the
 * factory-required side score strings and attaching scorer provenance.
 */
export function buildDelegatedOutcome(args: {
  score?: any;
  matchUpStatus?: string;
  winningSide?: number;
  scoreStringSide1: string;
  scoreStringSide2: string;
  scorer: DelegatedOutcomeScorer;
}): DelegatedOutcome {
  return {
    score: {
      ...(args.score ?? {}),
      scoreStringSide1: args.scoreStringSide1,
      scoreStringSide2: args.scoreStringSide2,
    },
    matchUpStatus: args.matchUpStatus,
    winningSide: args.winningSide,
    scorer: args.scorer,
  };
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
export function findDelegatedReconciliationIssues(args: {
  matchUps: any[];
  participants: any[];
}): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  for (const matchUp of args?.matchUps ?? []) {
    const delegated = readDelegatedOutcome(matchUp);
    if (!delegated) continue;
    // Only flag once the matchUp has an official outcome (a winningSide).
    const completed = matchUp?.winningSide != null || matchUp?.matchUpStatus === 'COMPLETED';
    if (!completed) continue;

    const personId = delegated.scorer?.personId ?? null;
    const { classification } = classifyScorer({ participants: args.participants, personId });
    if (classification === 'crowd' || classification === 'anonymous') {
      issues.push({ matchUpId: matchUp.matchUpId, scorer: delegated.scorer, classification });
    }
  }
  return issues;
}
