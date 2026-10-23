import { tools } from 'tods-competition-factory';

/**
 * How many participants a finishing-position link carries out of a round robin: each group's finishers at each of
 * the link's `finishingPositions`. A link out of a round robin is directed by `finishingPositions` whether it is
 * labelled POSITION or WINNER, and its `source.roundNumber` decides nothing (CA, 2026-10-23), so the factory's
 * predicate decides, with the draw so it can see the source structure.
 *
 * Returns undefined for any other link (a round link, or a finishing-position link whose source has no groups).
 */
export function finishingPositionQualifiers(link: any, drawDefinition: any): number | undefined {
  if (!tools.traversesByFinishingPosition(link, drawDefinition)) return undefined;
  const sourceStructureId = link?.source?.structureId;
  const source = drawDefinition?.structures?.find((s: any) => s?.structureId === sourceStructureId);
  const groupsCount = source?.structures?.length ?? 0;
  const finishingPositionsCount = link?.source?.finishingPositions?.length ?? 0;
  return groupsCount * finishingPositionsCount || undefined;
}
