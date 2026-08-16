/**
 * Conflict-of-interest evaluation for the matchUp official picker.
 *
 * The factory can refuse a conflicted official assignment; until now nothing surfaced that to an
 * operator, so the engine enforced a rule nobody could see. This module is the read side of that.
 *
 * Everything here is LOCAL. `tournamentEngine.getMatchUpOfficialConflicts` resolves the tournamentRecord
 * and drawDefinition from engine state given a `drawId`, and a relationship declared as GROUP membership
 * lives in the tournamentRecord itself — so there is no fetch, no API client and no dependency on an
 * external officials registry. A registry record would add durable cross-tournament declarations; its
 * absence is not a blocker, which matters because "no registry" must not silently mean "no conflicts".
 */
import { fixtures, policyConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

const { POLICY_OFFICIATING_CONFLICT_OF_INTEREST } = fixtures.policies;

const { POLICY_TYPE_OFFICIATING_CONFLICT } = policyConstants;

/** Severity of the worst conflict found for a candidate. `none` means evaluated and clean. */
export type ConflictLevel = 'none' | 'warn' | 'blocked';

export type CandidateConflicts = {
  level: ConflictLevel;
  /** Human-readable reasons straight from the factory — the UI lists them, it does not compose prose. */
  reasons: string[];
};

/**
 * Resolve the conflict policy: an attached provider policy wins, else the bundled default.
 *
 * Same shape as `tallyReportModal` / `getAttachedAvoidances`. The bundled default deliberately disables
 * NATIONALITY and treats a bare shared grouping as WARN, escalating only GROUPs whose `participantRole`
 * marks an authored relationship (COACH / MEDICAL / PHYSIO / TRAINER).
 */
export function resolveConflictPolicy(): any {
  const { policyDefinitions } =
    tournamentEngine.getPolicyDefinitions({
      policyTypes: [POLICY_TYPE_OFFICIATING_CONFLICT],
    }) ?? {};

  return policyDefinitions?.[POLICY_TYPE_OFFICIATING_CONFLICT]
    ? policyDefinitions
    : POLICY_OFFICIATING_CONFLICT_OF_INTEREST;
}

/** Reduce a factory conflict list to the single worst level plus its reasons. */
export function summarizeConflicts(result: any): CandidateConflicts {
  const conflicts = result?.conflicts ?? [];
  if (!conflicts.length) return { level: 'none', reasons: [] };

  const reasons = conflicts.map((conflict: any) => conflict?.reason).filter(Boolean);
  return { level: result?.blocked ? 'blocked' : 'warn', reasons };
}

/**
 * Evaluate one candidate official against one matchUp.
 *
 * Fails OPEN by design: if the evaluation errors, the candidate is reported `none` rather than blocked.
 * A UI that cannot evaluate must not invent a refusal — and it is not the enforcement point anyway, the
 * factory gate on the mutation is. That gate re-runs the same check server-side with the same policy.
 */
export function evaluateCandidate({
  officialParticipantId,
  policyDefinitions,
  matchUpId,
  drawId,
}: {
  officialParticipantId: string;
  policyDefinitions: any;
  matchUpId: string;
  drawId: string;
}): CandidateConflicts {
  const result: any = (tournamentEngine as any).getMatchUpOfficialConflicts({
    officialParticipantId,
    policyDefinitions,
    matchUpId,
    drawId,
  });

  if (result?.error) return { level: 'none', reasons: [] };
  return summarizeConflicts(result);
}
