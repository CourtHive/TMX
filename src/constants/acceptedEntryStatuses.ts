import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';

// Aligned with the factory's STRUCTURE_SELECTED_STATUSES (8 statuses).
// Previously only had 5 (missing CONFIRMED, LUCKY_LOSER, QUALIFIER).
const { STRUCTURE_SELECTED_STATUSES } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;

export const acceptedEntryStatuses = (stage: string = MAIN): string[] =>
  STRUCTURE_SELECTED_STATUSES.map((status: string) => `${stage}.${status}`);
