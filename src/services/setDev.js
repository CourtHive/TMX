import { addOrUpdateTournament } from 'services/storage/addTournament';
import { loadTournament } from 'Pages/Tournament/tournamentDisplay';
import { getLoginState } from './authentication/loginState';
import * as factory from 'tods-competition-factory';
import { tmx2db } from 'services/storage/tmx2db';
import { isObject } from 'functions/typeOf';
import { context } from 'services/context';
import { env } from 'settings/env';

import { TOURNAMENT } from 'constants/tmxConstants';

import { connectSocket, disconnectSocket, emitTmx } from './messaging/socketIo';
import { exportTournamentRecord } from 'components/modals/exportTournamentRecord';

export function setDev() {
  if (!window.dev) {
    console.log('%c dev initialized', 'color: yellow');
    window.dev = {};
  } else {
    return;
  }

  const help = () => console.log('set window.socketURL for messaging');

  addDev({
    getTournament: () => factory.tournamentEngine.getState()?.tournamentRecord,
    tournamentEngine: factory.tournamentEngine,
    context: factory.setDevContext,
    generateMockTournament,
    modifyTournament,
    getLoginState,
    factory,
    help
  });

  addDev({ connectSocket, disconnectSocket, emitTmx });
  addDev({ tmx2db, load, exportTournamentRecord });
  addDev({ env, tournamentContext: context });
}

function addDev(variable) {
  if (!isObject(window.dev)) return;

  try {
    Object.keys(variable).forEach((key) => (window.dev[key] = variable[key]));
  } catch (err) {
    console.log('production environment');
  }
}

function load(json) {
  if (typeof json === 'object') {
    const tournamentRecord = json.tournamentRecord || json;
    const tournamentId = tournamentRecord?.tournamentId;
    tournamentId && addAndDisplay(tournamentRecord);
  }
}

function modifyTournament(methods) {
  if (Array.isArray(methods)) {
    const tournamentId = factory.tournamentEngine.getState().tournamentRecord?.tournamentId;
    if (tournamentId) {
      const result = factory.tournamentEngine.executionQueue(methods);
      if (result.success || result.result?.success) {
        const tournamentRecord = factory.tournamentEngine.getState().tournamentRecord;
        const displayTournament = () => loadTournament({ tournamentRecord, config: { selectedTab: TOURNAMENT } });
        addOrUpdateTournament({ tournamentRecord, callback: displayTournament });
      }
    }
  }
}

function generateMockTournament(params) {
  const { tournamentRecord, error } = factory.mocksEngine.generateTournamentRecord(params);
  if (error) {
    console.log({ error });
  } else {
    addAndDisplay(tournamentRecord);
  }
}

function addAndDisplay(tournamentRecord) {
  const tournamentId = tournamentRecord?.tournamentId;
  const displayTournament = () => context.router.navigate(`/${TOURNAMENT}/${tournamentId}`);
  addOrUpdateTournament({ tournamentRecord, callback: displayTournament });
}