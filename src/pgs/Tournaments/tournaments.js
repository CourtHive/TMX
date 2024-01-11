import { createTournamentsTable } from 'components/tables/tournamentsTable/createTournamentsTable';
import { removeTournamentContent } from 'pages/Tournament/Container/tournamentContent';
import { resetTournament } from 'services/transitions/resetTournament';
import { showTMXtournaments } from 'services/transitions/screenSlaver';
import { destroyTables } from 'pages/Tournament/destroyTable';

export function tmxTournaments() {
  destroyTables();
  showTMXtournaments();
  removeTournamentContent();
  resetTournament();
  createTournamentsTable();
}
