import { tournamentEngine } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { tmx2db } from './tmx2db';

export function saveTournamentRecord(params) {
  const tournamentRecord = params.tournamentRecord ?? tournamentEngine.getTournament();
  tmx2db.addTournament(tournamentRecord).then(() => isFunction(params.callback) && params.callback());
}
