import { tournamentEngine } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { tmx2db } from './tmx2db';
import { debugConfig } from 'config/debugConfig';

export async function saveTournamentRecord(params?: { tournamentRecord?: any; callback?: () => void }): Promise<void> {
  debugConfig.get().log?.verbose && console.log('%c localSave', 'color: yellow');
  const tournamentRecord = params?.tournamentRecord ?? tournamentEngine.getTournament()?.tournamentRecord;
  await tmx2db.addTournament(tournamentRecord);
  if (isFunction(params?.callback) && params?.callback) {
    params.callback();
  }
}
