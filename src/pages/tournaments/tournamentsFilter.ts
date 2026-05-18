/**
 * Pure filter + sort functions for the tournaments listing.
 * Operates on the normalized TournamentRow shape produced by mapTournamentRecord.
 */

import { TournamentsSortField, TournamentsStatusFilter } from './tournamentsViewState';
import { TournamentRow } from './mapTournamentRecord';

function matchesStatus(row: TournamentRow, statusFilter: TournamentsStatusFilter): boolean {
  if (statusFilter === 'all') return true;
  const kind = row.tournament.status?.kind;
  if (statusFilter === 'live') return kind === 'live';
  if (statusFilter === 'completed') return kind === 'completed';
  if (statusFilter === 'upcoming') {
    return kind === 'closing-soon' || kind === 'registration-opens' || kind === 'registration-open' || kind === null || kind === undefined;
  }
  return true;
}

function matchesSearch(row: TournamentRow, query: string): boolean {
  if (!query) return true;
  return row.searchText.includes(query.toLowerCase());
}

export function filterTournaments(
  rows: TournamentRow[],
  statusFilter: TournamentsStatusFilter,
  query: string
): TournamentRow[] {
  return rows.filter((r) => matchesStatus(r, statusFilter) && matchesSearch(r, query));
}

function compareByField(a: TournamentRow, b: TournamentRow, field: TournamentsSortField): number {
  if (field === 'tournamentName') {
    return (a.tournament.tournamentName || '').localeCompare(b.tournament.tournamentName || '', undefined, { numeric: true });
  }
  if (field === 'participantCount') {
    return (a.tournament.participantCount ?? 0) - (b.tournament.participantCount ?? 0);
  }
  // startDate
  const at = new Date(a.tournament.startDate || 0).getTime();
  const bt = new Date(b.tournament.startDate || 0).getTime();
  return at - bt;
}

export function sortTournaments(
  rows: TournamentRow[],
  field: TournamentsSortField,
  dir: 'asc' | 'desc'
): TournamentRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => sign * compareByField(a, b, field));
}
