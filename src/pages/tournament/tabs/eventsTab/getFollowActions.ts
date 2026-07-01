/**
 * Compute "Go to {structure}" popover actions for a clicked participant.
 *
 * A participant who loses in MAIN and feeds into CONSOLATION (or any other
 * structure of the same draw) can be followed to where they currently sit.
 * For each OTHER structure of the draw that holds the participant, we surface
 * their furthest matchUp there (highest roundNumber = where they are now) so
 * the popover can navigate + highlight it.
 */

type FollowAction = {
  type: 'FOLLOW_TO_STRUCTURE';
  label: string;
  payload: {
    eventId?: string;
    drawId: string;
    structureId: string;
    matchUpId: string;
    participantId: string;
  };
};

const sideHasParticipant = (matchUp: any, participantId: string): boolean =>
  !!matchUp?.sides?.some((s: any) => (s?.participantId || s?.participant?.participantId) === participantId);

export function getFollowActions({
  participantId,
  currentStructureId,
  drawId,
  eventId,
  eventData,
  matchUps,
}: {
  participantId?: string;
  currentStructureId?: string;
  drawId?: string;
  eventId?: string;
  eventData: any;
  matchUps: any[];
}): FollowAction[] {
  if (!participantId || !drawId) return [];

  const drawData = eventData?.drawsData?.find((d: any) => d.drawId === drawId);
  const structures = drawData?.structures ?? [];
  // Only top-level structures are navigable targets (skips round-robin sub-structure ids).
  const structureNameById = new Map<string, string>(
    structures.map((s: any) => [s.structureId, s.structureName || s.stage || 'Structure']),
  );

  // Best (furthest) matchUp per other structure holding the participant.
  const bestByStructure = new Map<string, any>();
  for (const matchUp of matchUps) {
    const structureId = matchUp?.structureId;
    if (matchUp?.drawId !== drawId || !structureId || structureId === currentStructureId) continue;
    if (!structureNameById.has(structureId)) continue;
    if (!sideHasParticipant(matchUp, participantId)) continue;

    const current = bestByStructure.get(structureId);
    if (!current || (matchUp.roundNumber ?? 0) > (current.roundNumber ?? 0)) {
      bestByStructure.set(structureId, matchUp);
    }
  }

  return [...bestByStructure.entries()].map(([structureId, matchUp]) => ({
    type: 'FOLLOW_TO_STRUCTURE',
    label: `Go to ${structureNameById.get(structureId)}`,
    payload: { eventId, drawId, structureId, matchUpId: matchUp.matchUpId, participantId },
  }));
}
