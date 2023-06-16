import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { LEAVE_TOURNAMENT } from 'constants/comsConstants';

export function resetTournament() {
  const { tournamentRecord } = tournamentEngine.getState();

  if (tournamentRecord) {
    context.ee.emit(LEAVE_TOURNAMENT, tournamentRecord.tournamentId);
    tournamentEngine.reset();
  }
}
