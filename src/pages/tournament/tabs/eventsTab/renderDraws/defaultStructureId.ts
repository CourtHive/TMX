import { drawDefinitionConstants, factoryConstants } from 'tods-competition-factory';

const { QUALIFYING } = drawDefinitionConstants;
const { completedMatchUpStatuses } = factoryConstants;

/** A BYE needs no score, so it never holds a structure open. */
const NEEDS_NO_SCORE = new Set<string>([...completedMatchUpStatuses, 'BYE']);

function structureMatchUps(structure: any): any[] {
  if (structure?.matchUps?.length) return structure.matchUps;
  return Object.values(structure?.roundMatchUps || {}).flat();
}

/**
 * Whether a structure still has scores to enter.
 *
 * A structure with no matchUps yet counts as unfinished: its next step (generating it) is still ahead.
 */
export function hasUnenteredScores(structure: any): boolean {
  const matchUps = structureMatchUps(structure);
  if (!matchUps.length) return true;
  return matchUps.some((matchUp: any) => !matchUp?.winningSide && !NEEDS_NO_SCORE.has(matchUp?.matchUpStatus));
}

/**
 * The structure a draw opens on when none was asked for.
 *
 * CA, 2026-10-15: *"when there is a qualifying structure and a main structure (simplest case) and the
 * qualifying structure is complete, we should open on the main structure, the structure that still
 * required score entry. Qualifying should only open first if it has unentered scores."*
 *
 * So a qualifying structure is passed over once every score in it is entered; every other structure
 * keeps its place. With no qualifying, or a qualifying still in play, this is the first structure —
 * exactly what every caller used before.
 */
export function defaultStructureId(structures: any[] | undefined): string | undefined {
  if (!structures?.length) return undefined;
  const opening = structures.find((structure) => structure?.stage !== QUALIFYING || hasUnenteredScores(structure));
  return (opening ?? structures[0])?.structureId;
}
