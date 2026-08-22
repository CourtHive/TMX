import { ERR_MATCHUP_HAS_SCHEDULING } from 'constants/tmxConstants';

/**
 * Whether a failed mutation is the engine asking which way to go on BYE placement.
 *
 * `assignDrawPositionBye` refuses an operator position-action that targets a matchUp
 * already holding a court or a time: a director may be mid-swap and want the slot kept,
 * or may want it released, and guessing either way destroys work. The caller re-dispatches
 * with an explicit `preserveScheduling` once the director has answered.
 *
 * Checks the per-method results as well as the top level, because `executionQueue`
 * reports method failures inside `results[]`.
 *
 * Kept out of the popover module so it can be unit-tested: the popover imports cModal,
 * which touches `document` at module load, and TMX unit tests run without a DOM.
 */
export function isSchedulingAmbiguity(result: any): boolean {
  if (!result || result.success) return false;
  const isAmbiguity = (code?: string) => code === ERR_MATCHUP_HAS_SCHEDULING;
  if (isAmbiguity(result.error?.code)) return true;
  return (result.results ?? []).some((methodResult: any) => isAmbiguity(methodResult?.error?.code));
}
