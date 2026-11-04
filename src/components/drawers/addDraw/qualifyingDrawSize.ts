/**
 * A qualifying draw smaller than the qualifying entries it would take is blocked in the drawer (CA 2026-11-04): the
 * factory refuses explicit qualifying entries that overfill the draw, and the director should choose a larger draw or
 * withdraw entries first rather than meet that refusal after Generate.
 *
 * Entries already on the draw (placed in a qualifying structure that already feeds it) keep their places and do not
 * count against the new structure.
 */
export function getQualifyingOverfill({
  existingEntries = [],
  stageEntries,
  drawSize,
}: {
  existingEntries?: { participantId: string }[];
  stageEntries: { participantId: string }[];
  drawSize: number;
}): { entriesCount: number; drawSize: number } | undefined {
  const existingIds = new Set(existingEntries.map(({ participantId }) => participantId));
  const entriesCount = stageEntries.filter(({ participantId }) => !existingIds.has(participantId)).length;
  return entriesCount > drawSize ? { entriesCount, drawSize } : undefined;
}
