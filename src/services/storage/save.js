import { tournamentEngine } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { tmx2db } from './tmx2db';

export function saveTournamentRecord({ callback } = {}) {
  const { tournamentRecord } = tournamentEngine.getState();
  tmx2db.addTournament(tournamentRecord).then(() => isFunction(callback) && callback());
}

export const save = (function () {
  let fx = {};

  fx.local = ({ callback } = {}) => {
    const { tournamentRecord } = tournamentEngine.getState();
    tmx2db.addTournament(tournamentRecord).then(() => isFunction(callback) && callback());
    console.log('saved local', { callback });
  };

  fx.cloud = ({ saveLocal = true, callback } = {}) => {
    console.log({ saveLocal, callback });
  };

  return fx;
})();
