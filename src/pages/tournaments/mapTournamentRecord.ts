/**
 * Normalize a TODS tournament record into the row shape consumed by the
 * tournaments page (both card grid and Tabulator table).
 *
 * Delegates field extraction to {@link mapTournamentToCardData} in
 * courthive-components so TMX and courthive-public share one implementation.
 *
 * `searchText` is the lowercased haystack used by the search box; it combines
 * tournament name + location + tier value so users can filter by federation
 * tier (e.g. typing "J500") in addition to name / location.
 *
 * `tier` is extracted directly from the raw record so the Tabulator column
 * can sort and filter on it without depending on a specific
 * courthive-components version. Once the consumer's courthive-components
 * dep ships TierClassification on TournamentCardData, the card chip
 * renders automatically with no further TMX change.
 */

import { mapTournamentToCardData, TournamentCardData } from 'courthive-components';

export interface TournamentTier {
  system: string;
  value: string;
  numericRank?: number;
}

export interface TournamentRow {
  tournamentId: string;
  id: string;
  searchText: string;
  tournament: TournamentCardData;
  tier?: TournamentTier;
}

function extractTier(tournamentRecord: any): TournamentTier | undefined {
  const tier = tournamentRecord?.tournamentTier;
  if (!tier || typeof tier !== 'object') return undefined;
  if (typeof tier.system !== 'string' || typeof tier.value !== 'string') return undefined;
  const out: TournamentTier = { system: tier.system, value: tier.value };
  if (typeof tier.numericRank === 'number' && Number.isFinite(tier.numericRank)) {
    out.numericRank = tier.numericRank;
  }
  return out;
}

export function mapTournamentRecord(tournamentRecord: any): TournamentRow {
  const data = mapTournamentToCardData(tournamentRecord);
  const tier = extractTier(tournamentRecord);
  const searchParts = [data.tournamentName, data.location, tier?.value].filter(Boolean) as string[];
  const searchText = searchParts.length ? searchParts.join(' ').toLowerCase() : 'Error';
  return {
    tournamentId: data.tournamentId,
    id: data.tournamentId,
    searchText,
    tournament: data,
    tier
  };
}
