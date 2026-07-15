import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';

// Aligned with the factory's STRUCTURE_SELECTED_STATUSES (8 statuses).
// Previously only had 5 (missing CONFIRMED, LUCKY_LOSER, QUALIFIER).
const { STRUCTURE_SELECTED_STATUSES } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;

// Single source of truth for the "accepted" (structure-selected) entry statuses.
// Import this set rather than re-deriving `new Set(STRUCTURE_SELECTED_STATUSES)`
// at each call site — that hand-rolled duplication is exactly what drifted out
// of alignment before (CONFIRMED/LUCKY_LOSER/QUALIFIER were silently dropped,
// breaking manual seeding for those statuses).
export const acceptedStatusSet: ReadonlySet<string> = new Set(STRUCTURE_SELECTED_STATUSES);

export const acceptedEntryStatuses = (stage: string = MAIN): string[] =>
  STRUCTURE_SELECTED_STATUSES.map((status: string) => `${stage}.${status}`);
