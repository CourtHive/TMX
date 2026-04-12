/**
 * Pure hide-condition logic for draw action menu items.
 * Extracted from getActionOptions for testability.
 */

export interface ActionVisibilityParams {
  isAssignableStage: boolean;
  blockAssignment: boolean;
  isTeamEvent: boolean;
  hasUnassignedPositions: boolean;
  isEmptyDraw: boolean;
  hasDraft: boolean;
  hasQualifying: boolean;
  stageIsMain: boolean;
  stageSequence: number;
  isDual: boolean;
}

export interface ActionVisibility {
  assignParticipants: boolean;
  autoPlace: boolean;
  configureDraft: boolean;
  resolveDraft: boolean;
  editScorecard: boolean;
  removeStructure: boolean;
  printDraw: boolean;
  removePlayers: boolean;
  clearResults: boolean;
}

export function getActionVisibility(params: ActionVisibilityParams): ActionVisibility {
  const {
    isAssignableStage,
    blockAssignment,
    isTeamEvent,
    hasUnassignedPositions,
    isEmptyDraw,
    hasDraft,
    hasQualifying,
    stageIsMain,
    stageSequence,
    isDual,
  } = params;

  return {
    assignParticipants: isAssignableStage && !blockAssignment && !isTeamEvent && !hasUnassignedPositions,
    autoPlace: isAssignableStage && isEmptyDraw,
    configureDraft: hasDraft,
    resolveDraft: hasDraft,
    editScorecard: isTeamEvent,
    removeStructure: !(stageIsMain && stageSequence === 1 && !hasQualifying),
    printDraw: true,
    removePlayers: isDual,
    clearResults: isDual,
  };
}
