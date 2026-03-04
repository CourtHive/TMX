import { createTournamentsTable } from 'components/tables/tournamentsTable/createTournamentsTable';
import { removeTournamentContent } from 'pages/tournament/container/tournamentContent';
import { resetTournament } from 'services/transitions/resetTournament';
import { showTMXtournaments } from 'services/transitions/screenSlaver';
import { destroyTables } from 'pages/tournament/destroyTable';
import { homeNavigation } from 'homeNavigation';
import { TMX_TOURNAMENTS } from 'constants/tmxConstants';

export function tmxTournaments(): void {
  destroyTables();
  showTMXtournaments();
  removeTournamentContent();
  resetTournament();
  createTournamentsTable();
  homeNavigation(TMX_TOURNAMENTS);
}
