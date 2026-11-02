import { queryGovernor } from 'tods-competition-factory';

/**
 * Peer tournament ids linked to a record, excluding the record itself.
 *
 * Reads through the factory's own reader, so a record whose links sit only in the legacy
 * `linkedTournamentsIds` extension (no `linkedTournamentIds` attribute) still yields its peers.
 * The attribute wins when present; otherwise the extension is used.
 */
export function peerLinkedTournamentIds(record: any): string[] {
  const tournamentId = record?.tournamentId;
  if (!tournamentId) return [];
  const result: any = queryGovernor.getLinkedTournamentIds({ tournamentRecords: { [tournamentId]: record } });
  return (result?.linkedTournamentIds?.[tournamentId] ?? []).filter(Boolean);
}
