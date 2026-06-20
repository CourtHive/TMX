import { invalidateAllScheduleCaches } from 'pages/tournament/tabs/schedule2Tab/schedule2DataCache';
import { createTournamentsTable } from 'components/tables/tournamentsTable/createTournamentsTable';
import { removeTournamentContent } from 'pages/tournament/container/tournamentContent';
import { resetTournament } from 'services/transitions/resetTournament';
import { showTMXtournaments } from 'services/transitions/screenSlaver';
import { destroyTables } from 'pages/tournament/destroyTable';
import { homeNavigation } from 'homeNavigation';
import { TMX_TOURNAMENTS } from 'constants/tmxConstants';

export function tmxTournaments(): void {
  // Leaving a tournament for the list: drop every schedule2 cache, including
  // the page-scoped dateRange/tournamentInfo entries. They must not survive
  // away-navigation — re-entering the same tournament should always re-read
  // fresh (its dates or metadata may have changed while we were away, and a
  // same-id re-entry is a no-op for syncTournamentContext).
  invalidateAllScheduleCaches();
  destroyTables();
  showTMXtournaments();
  removeTournamentContent();
  resetTournament();
  createTournamentsTable();
  homeNavigation(TMX_TOURNAMENTS);
}
