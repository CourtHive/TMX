import produce from 'immer';

import storeInitialState from '../storeInitialState';

import { setToasterState } from '../primitives/toasterState';
import { isDev } from 'functions/isDev';

import { tournamentEngine } from 'tods-competition-factory';
import { save } from 'services/storage/save';

/*
  // EXAMPLE use pattern:
  dispatch({
      type: 'tournamentEngine',
      payload: { methods: [ { method: 'methodName', params: {}} ] }
  });
*/

const invokeTournamentEngine = (state, action) =>
  produce(state, (draftState) => {
    const tournamentId = draftState.selectedTournamentId;
    if (!tournamentId) {
      return console.log('%c Missing tournamentId', 'color: red');
    }

    const tournamentRecord = draftState.records[tournamentId];
    if (!tournamentRecord) {
      return console.log('%c Missing tournamentRecord', 'color: red');
    }

    const { methods } = action.payload;
    const availableMethods = Object.keys(tournamentEngine);

    tournamentEngine.devContext(isDev()).setState(tournamentRecord);

    const errors = [];
    let modifications = 0;

    methods &&
      methods.forEach((request) => {
        const { method, params } = request;
        if (method && availableMethods.includes(method)) {
          const result = tournamentEngine[method](params);
          if (result && result.success) {
            /*
            context.ee.emit('emitTmx', {
              action: 'tournamentEngineMethod',
              payload: { tournamentId, method, params }
            });
            */

            modifications++;
          } else if (result && result.error) {
            errors.push(result.error);
          }
        } else {
          console.log(`%c tournamentEngine Method not found: ${method}`, 'color: pink');
        }
      });

    if (modifications) {
      const { tournamentRecord } = tournamentEngine.getState();
      draftState.records[tournamentId] = tournamentRecord;
      save.local({ tournament: tournamentRecord });
    }

    if (errors.length) {
      console.log({ errors });
      const payload = { icon: 'error', severity: 'warning', message: `${errors.length} Errors` };
      setToasterState({ draftState, payload });
    }
  });

const addTournament = (state, action) =>
  produce(state, (draftState) => {
    const tournamentId = action?.payload?.unifiedTournamentId?.tournamentId || action?.payload?.tournamentId;
    if (tournamentId) {
      tournamentEngine.setState(action.payload);
      draftState.records[tournamentId] = action.payload;
      draftState.selectedTournamentId = tournamentId;
    }
  });

const changeTournament = (state, action) =>
  produce(state, (draftState) => {
    const tournamentId = action?.payload?.unifiedTournamentId?.tournamentId || action?.payload?.tournamentId;
    const initialState = storeInitialState();
    if (tournamentId) {
      Object.assign(draftState, initialState, { initialized: true });
      tournamentEngine.setState(action.payload);
      draftState.records = { [tournamentId]: action.payload };
      draftState.selectedTournamentId = tournamentId;
    }
  });

const clearTournament = (state) =>
  produce(state, (draftState) => {
    tournamentEngine.reset();
    draftState.records = {};
    draftState.selectedTournamentId = null;
  });

export const tournamentProducer = {
  'add tournament': addTournament,
  'clear tournament': clearTournament,
  'change tournament': changeTournament,
  tournamentEngine: invokeTournamentEngine
};

export default tournamentProducer;
