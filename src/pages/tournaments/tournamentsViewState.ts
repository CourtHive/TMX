/**
 * Tournaments page view state — view mode + filter + sort + search, with
 * localStorage persistence for view mode.
 */

export type TournamentsViewMode = 'grid' | 'table';

export type TournamentsStatusFilter = 'all' | 'upcoming' | 'live' | 'completed';

export type TournamentsSortField = 'startDate' | 'tournamentName' | 'participantCount';

export interface TournamentsViewState {
  viewMode: TournamentsViewMode;
  statusFilter: TournamentsStatusFilter;
  sortField: TournamentsSortField;
  sortDir: 'asc' | 'desc';
  searchQuery: string;
}

const VIEW_MODE_KEY = 'tmx_tournaments_view_mode';

function readViewMode(): TournamentsViewMode {
  try {
    const stored = globalThis.localStorage?.getItem(VIEW_MODE_KEY);
    return stored === 'grid' ? 'grid' : 'table';
  } catch {
    return 'table';
  }
}

function writeViewMode(mode: TournamentsViewMode): void {
  try {
    globalThis.localStorage?.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function initialTournamentsViewState(): TournamentsViewState {
  return {
    viewMode: readViewMode(),
    statusFilter: 'all',
    sortField: 'startDate',
    sortDir: 'desc',
    searchQuery: ''
  };
}

export function persistViewMode(mode: TournamentsViewMode): void {
  writeViewMode(mode);
}
