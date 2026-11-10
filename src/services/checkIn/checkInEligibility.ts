import { factoryConstants, scoreGovernor } from 'tods-competition-factory';

const CHECK_OUT_LOCKED = new Set<string>([
  ...factoryConstants.activeMatchUpStatuses,
  ...factoryConstants.completedMatchUpStatuses,
]);

/** Mirrors checkOutParticipant's play guard. The engine still validates the acknowledged write. */
export function checkOutLocked(matchUp: any): boolean {
  return CHECK_OUT_LOCKED.has(matchUp?.matchUpStatus) || !!scoreGovernor.checkScoreHasValue(matchUp ?? {});
}
