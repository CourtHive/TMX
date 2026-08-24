/**
 * Is this official certified and un-suspended for this assignment?
 *
 * The companion to `officialConflicts` and **deliberately the same verdict vocabulary**. The picker
 * shows one badge per candidate, so two parallel level types would force it to invent a merge rule
 * in the renderer — where TMX has no jsdom and it would get no coverage.
 *
 * The rules live in the factory (`getOfficialEligibility`); the record lives in AMS. This module owns
 * only the translation into a verdict and the merge with the conflict verdict.
 *
 * **`unknown` is a first-class answer — but only where the registry is actually in use.**
 *
 * The plan is explicit that most tournaments have no AMS registry configured, and that this is a
 * legitimate configuration rather than a degraded one: officials are simply INDIVIDUAL participants
 * with the OFFICIAL role. If a missing registry made every candidate read *not checked*, the
 * annotation would fire on every row at almost every tournament — and a warning on everything is a
 * warning on nothing. It would also bury the conflict-of-interest signal, which **is** checkable
 * locally and always runs.
 *
 * So eligibility contributes a verdict only once the registry has demonstrably answered for
 * somebody. Same rule, and the same reasoning, as the check-in prompt heuristic: silent where the
 * feature is not in use, informative where it is.
 *
 * | situation | contributes |
 * |---|---|
 * | registry unreachable, or configured for nobody | **nothing** — COI's verdict stands alone |
 * | registry answered for others, no record for this person | `unknown` — genuinely not checked |
 * | registry answered, factory says ineligible | `blocked` |
 * | registry answered, factory says eligible | `none` |
 *
 * Caught by journey 94 rather than by review: an earlier cut returned `unknown` whenever the
 * registry was absent, and every candidate in a registry-less tournament went from annotated-clean
 * to not-checked.
 */

import { tournamentEngine } from 'tods-competition-factory';

// constants and types
import type { ConflictLevel, CandidateConflicts } from './officialConflicts';
import type { OfficialRecord } from 'services/apis/officiatingApi';

/** Worst-wins ordering. `unknown` outranks `none`: "we could not check" must not read as clean. */
const SEVERITY: ConflictLevel[] = ['blocked', 'warn', 'unknown', 'none'];

export interface EligibilityArgs {
  /** `undefined` means the registry could not be asked at all — distinct from "no record for them". */
  recordsById?: Record<string, OfficialRecord>;
  personId?: string;
  certificationFamily?: string;
  certificationLevel?: string;
  organisationId?: string;
  asOfDate?: string;
}

export function evaluateEligibility({
  recordsById,
  personId,
  certificationFamily,
  certificationLevel,
  organisationId,
  asOfDate,
}: EligibilityArgs): CandidateConflicts | undefined {
  // Unreachable, or configured for nobody. Contribute nothing rather than painting every row.
  // `undefined` and `{}` are deliberately treated alike: we cannot distinguish "AMS is down" from
  // "no registry here", and the majority case is the latter.
  if (!recordsById || !Object.keys(recordsById).length) return undefined;

  // The registry IS in use and has no record for this person — genuinely not checked.
  const officialRecord = personId ? recordsById[personId] : undefined;
  if (!officialRecord) return { level: 'unknown', reasons: [] };

  const result: any = (tournamentEngine as any).getOfficialEligibility({
    officialRecord,
    certificationFamily,
    certificationLevel,
    organisationId,
    asOfDate,
  });

  if (result?.error) return { level: 'unknown', reasons: [String(result.error?.message ?? result.error)] };

  // Ineligibility BLOCKS rather than warns: unlike a conflict of interest, which a referee may
  // knowingly accept, an expired certification or an active suspension is not theirs to waive.
  if (result?.eligible === false) return { level: 'blocked', reasons: result?.reasons ?? [] };
  return { level: 'none', reasons: [] };
}

/**
 * Fold several verdicts into the one the picker renders. Worst wins; reasons accumulate in order.
 *
 * A candidate who is both conflicted and uncertified should say both — a picker that shows only the
 * first reason teaches operators that clearing one issue clears the row.
 */
export function mergeVerdicts(...verdicts: (CandidateConflicts | undefined)[]): CandidateConflicts {
  const present = verdicts.filter(Boolean) as CandidateConflicts[];
  if (!present.length) return { level: 'unknown', reasons: [] };

  const level = SEVERITY.find((candidate) => present.some((verdict) => verdict.level === candidate)) ?? 'none';
  return { level, reasons: present.flatMap((verdict) => verdict.reasons ?? []) };
}
