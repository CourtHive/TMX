/**
 * The profile schedulers' refusals that TMX answers with more than a toast.
 *
 * - **Repair required** (`ERR_SCHEDULING_PROFILE_REPAIR_REQUIRED`): the stored profile names a venue, event or draw
 *   that is gone. The factory no longer saves a repair when the profile is read (a query runs on one side only, so the
 *   save parted the client from the server); the scheduler refuses and offers the repaired profile, which TMX saves
 *   with `setSchedulingProfile`, a mutation that runs on both.
 * - **The plan's played-order guard** (`ANACHRONISM` with `context.refusals`): the plan placed matchUps before played
 *   matchUps they depend on, and nothing was written. A planner defect, not a TD's; it is said plainly.
 */
const REPAIR_REQUIRED = 'ERR_SCHEDULING_PROFILE_REPAIR_REQUIRED';
const ANACHRONISM = 'ANACHRONISM';

export type ProfileRepairOffer = {
  repairedSchedulingProfile: any[];
  modifications: number;
  issues: string[];
};

/** the repair a scheduler's refusal offers, or undefined when the result is anything else */
export function profileRepairOffer(result: any): ProfileRepairOffer | undefined {
  if (result?.error?.code !== REPAIR_REQUIRED) return undefined;
  const { repairedSchedulingProfile, modifications, issues } = result?.context ?? {};
  if (!Array.isArray(repairedSchedulingProfile)) return undefined;
  return { repairedSchedulingProfile, modifications: modifications ?? 0, issues: issues ?? [] };
}

/** how many placements the plan's played-order guard refused, or undefined when the result is anything else */
export function planGuardRefusalCount(result: any): number | undefined {
  if (result?.error?.code !== ANACHRONISM) return undefined;
  const refusals = result?.context?.refusals;
  return Array.isArray(refusals) ? refusals.length : undefined;
}

/** a scheduler result's error, from a single result or the last result of an executionQueue */
export function schedulerResultOf(eqResult: any): any {
  const results = eqResult?.results;
  const result = Array.isArray(results) ? results[results.length - 1] : eqResult;
  return result?.error ? result : eqResult;
}
