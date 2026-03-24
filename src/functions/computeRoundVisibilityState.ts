/**
 * Compute per-round visibility state (hidden / embargoed) for a draw structure.
 * Pure function — depends only on the publish state data and matchUp round numbers.
 *
 * TODO: Replace with `publishingGovernor.getRoundVisibilityState()` from
 * tods-competition-factory once available in a published release.
 */
import { isEmbargoActive } from './isEmbargoActive';

interface RoundVisibility {
  hidden?: boolean;
  embargoed?: boolean;
}

export function computeRoundVisibilityState(
  structureDetail: any,
  matchUps: any[],
): Record<number, RoundVisibility> | undefined {
  if (!structureDetail) return undefined;

  const roundLimit = structureDetail.roundLimit;
  const scheduledRounds = structureDetail.scheduledRounds || {};
  const maxRound = matchUps.reduce((max: number, m: any) => Math.max(max, m.roundNumber || 0), 0);
  if (maxRound === 0) return undefined;

  const state: Record<number, RoundVisibility> = {};
  let hasState = false;

  for (let rn = 1; rn <= maxRound; rn++) {
    const entry: RoundVisibility = {};
    if (roundLimit != null && rn > roundLimit) {
      entry.hidden = true;
      hasState = true;
    }
    const rd = scheduledRounds[rn];
    if (isEmbargoActive(rd?.embargo)) {
      entry.embargoed = true;
      hasState = true;
    }
    if (entry.hidden || entry.embargoed) {
      state[rn] = entry;
    }
  }

  return hasState ? state : undefined;
}
