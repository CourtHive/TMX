/**
 * The segment vocabulary for creating doubles pairs.
 *
 * TMX's Accepted / Qualifying / Alternate are *segments*, not entry statuses — each resolves to an
 * (entryStatus, entryStage) pair. Kept in its own leaf module so the rules are unit-testable
 * without dragging in the DOM-bound table code that consumes them.
 */
import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';

import { ACCEPTED } from 'constants/tmxConstants';

const { ALTERNATE, DIRECT_ACCEPTANCE } = entryStatusConstants;
const { MAIN, QUALIFYING } = drawDefinitionConstants;

/** Segments a created pair may enter, in the order the toolbar toggle cycles them. */
export const PAIR_SEGMENTS = [ALTERNATE, ACCEPTED, QUALIFYING];

/**
 * Resolve a segment to the (entryStatus, entryStage) pair the factory expects.
 * Mirrors `modifyEntriesStatus` deliberately: a pair created "as Accepted" and an entry *moved*
 * to Accepted must land in the same segment, or the unified table sorts them apart.
 */
export function segmentToEntry(segment: string): { entryStatus: string; entryStage: string } {
  if (segment === ACCEPTED) return { entryStatus: DIRECT_ACCEPTANCE, entryStage: MAIN };
  if (segment === QUALIFYING) return { entryStatus: DIRECT_ACCEPTANCE, entryStage: QUALIFYING };
  return { entryStatus: ALTERNATE, entryStage: MAIN };
}

/**
 * "Accepted" means accepted *in whatever stage the individuals already occupy* — pairing two
 * qualifying-stage draw entries must not silently demote the pair to MAIN. Returns undefined
 * (let the segment decide the stage) unless the selection unanimously shares one entryStage.
 *
 * Choosing Alternate or Qualifying is an explicit decision and is never overridden.
 */
export function inheritedEntryStage(selected: any[], segment: string): string | undefined {
  if (segment !== ACCEPTED) return undefined;
  const stages = new Set(selected.map((row: any) => row.entryStage).filter(Boolean));
  return stages.size === 1 ? [...stages][0] : undefined;
}
