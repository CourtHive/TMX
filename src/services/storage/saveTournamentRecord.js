import { tournamentEngine } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { tmx2db } from './tmx2db';

export async function saveTournamentRecord(params) {
  const tournamentRecord = params?.tournamentRecord ?? tournamentEngine.getTournament()?.tournamentRecord;
  await tmx2db.addTournament(tournamentRecord);
  isFunction(params?.callback) && params.callback();
}
