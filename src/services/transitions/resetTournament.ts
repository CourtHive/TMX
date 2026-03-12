import { leaveTournamentRoom } from 'services/messaging/socketIo';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { LEAVE_TOURNAMENT } from 'constants/comsConstants';

export function resetTournament(): void {
  const { tournamentRecord } = tournamentEngine.getTournament();

  if (tournamentRecord) {
    context.ee.emit(LEAVE_TOURNAMENT, tournamentRecord.tournamentId);
    leaveTournamentRoom(tournamentRecord.tournamentId);
    tournamentEngine.reset();
  }
}
