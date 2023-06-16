import { createTournamentsTable } from 'components/tables/tournamentsTable/createTournamentsTable';
import { removeTournamentContent } from 'Pages/Tournament/Container/tournamentContent';
import { resetTournament } from 'services/transitions/resetTournament';
import { showTMXtournaments } from 'services/transitions/screenSlaver';

export function tmxTournaments() {
  showTMXtournaments();
  removeTournamentContent();
  resetTournament();
  createTournamentsTable();
}
