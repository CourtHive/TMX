// Pure, dependency-free helpers for the linked-tournaments settings panel. Kept separate from
// linkedTournaments.ts (which imports the engine/api/modal graph) so they are unit-testable in
// isolation without loading heavy UI modules.

export interface SiblingTournament {
  tournamentId: string;
  tournamentName: string;
  providerId?: string;
  startDate?: string;
  endDate?: string;
}

/** Peer links stored on a record, excluding the record itself (the factory stores self in the list). */
export function getPeerLinkedIds(record: any): string[] {
  const self = record?.tournamentId;
  return (record?.linkedTournamentIds ?? []).filter((id: string) => id && id !== self);
}

/** The full link group to persist: primary + existing peers + newly selected ids (unique, non-empty). */
export function buildLinkGroup(primaryId: string, existingPeerIds: string[], addIds: string[]): string[] {
  return Array.from(new Set([primaryId, ...existingPeerIds, ...addIds])).filter(Boolean);
}

/** Resolve linked ids to display rows using the sibling list; unknown ids fall back to the id as name. */
export function resolveLinkedRows(peerIds: string[], siblings: SiblingTournament[]): SiblingTournament[] {
  const byId = new Map(siblings.map((sibling) => [sibling.tournamentId, sibling]));
  return peerIds.map((id) => byId.get(id) ?? { tournamentId: id, tournamentName: id });
}

/** Same-provider siblings that are neither the primary nor already linked — candidates to link. */
export function availableToLink(
  primaryId: string,
  providerId: string | undefined,
  existingPeerIds: string[],
  siblings: SiblingTournament[],
): SiblingTournament[] {
  const linked = new Set(existingPeerIds);
  return siblings.filter(
    (sibling) =>
      sibling.tournamentId !== primaryId &&
      !linked.has(sibling.tournamentId) &&
      (!providerId || sibling.providerId === providerId),
  );
}
