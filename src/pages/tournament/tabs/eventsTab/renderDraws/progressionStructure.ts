/**
 * Pick the structure the progression sunburst should render.
 *
 * The burst chart is a single-elimination bracket visualization: it assumes each
 * round halves (`drawSize = 2 * round1Count`). Round-robin structures
 * (`finishingPosition: WIN_RATIO`) have no bracket progression, so a composite
 * draw must render its ELIMINATION structure — never the round-robin one:
 *   - Qualifying round-robin → main single-elimination: render the MAIN bracket.
 *   - Main round-robin → elimination playoff: render the PLAY_OFF bracket.
 *   - Pure round-robin (no playoff): no bracket exists → render nothing.
 *
 * Feeding `structures[0]` (the old behavior) rendered the round-robin structure's
 * non-halving rounds as if single-elimination, lumping in every RR matchUp
 * unconnected.
 *
 * Operates on the enriched `getEventData().drawsData[i].structures` shape (each
 * carries `finishingPosition` + `stage`). Returns the bracket structure — a
 * MAIN-stage elimination structure when present, else the first elimination
 * structure — or `undefined` when the draw has no elimination bracket.
 */
import { drawDefinitionConstants } from 'tods-competition-factory';

const { ROUND_OUTCOME, MAIN } = drawDefinitionConstants;

export function pickProgressionStructure(structures?: any[]): any | undefined {
  if (!structures?.length) return undefined;
  const elimination = structures.filter((structure: any) => structure?.finishingPosition === ROUND_OUTCOME);
  if (!elimination.length) return undefined;
  return elimination.find((structure: any) => structure.stage === MAIN) ?? elimination[0];
}
