/**
 * Normalize a TODS tournament record into the row shape consumed by the
 * tournaments page (both card grid and Tabulator table).
 *
 * Delegates field extraction to {@link mapTournamentToCardData} in
 * courthive-components so TMX and courthive-public share one implementation.
 *
 * `searchText` is the lowercased haystack used by the search box; it combines
 * tournament name + location so users can search by either.
 */

import { mapTournamentToCardData, TournamentCardData } from 'courthive-components';

export interface TournamentRow {
  tournamentId: string;
  id: string;
  searchText: string;
  tournament: TournamentCardData;
}

export function mapTournamentRecord(tournamentRecord: any): TournamentRow {
  const data = mapTournamentToCardData(tournamentRecord);
  const searchParts = [data.tournamentName, data.location].filter(Boolean) as string[];
  const searchText = searchParts.length ? searchParts.join(' ').toLowerCase() : 'Error';
  return {
    tournamentId: data.tournamentId,
    id: data.tournamentId,
    searchText,
    tournament: data
  };
}
