import { tournamentEngine } from 'tods-competition-factory';
import { debugConfig } from 'config/debugConfig';
import { tmx2db } from './tmx2db';

export async function saveTournamentRecord(params?: { tournamentRecord?: any }): Promise<void> {
  debugConfig.get().log?.verbose && console.log('%c localSave', 'color: yellow');
  const tournamentRecord = params?.tournamentRecord ?? tournamentEngine.getTournament()?.tournamentRecord;
  await tmx2db.addTournament(tournamentRecord);
}
