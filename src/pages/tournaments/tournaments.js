import { createTournamentsTable } from 'components/tables/tournamentsTable/createTournamentsTable';
import { removeTournamentContent } from 'pages/tournament/container/tournamentContent';
import { resetTournament } from 'services/transitions/resetTournament';
import { showTMXtournaments } from 'services/transitions/screenSlaver';
import { destroyTables } from 'pages/tournament/destroyTable';

export function tmxTournaments() {
  destroyTables();
  showTMXtournaments();
  removeTournamentContent();
  resetTournament();
  createTournamentsTable();
}
