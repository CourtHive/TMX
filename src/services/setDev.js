import { addOrUpdateTournament } from 'services/storage/addTournament';
import { loadTournament } from 'Pages/Tournament/tournamentDisplay';
import { getLoginState } from './authentication/loginState';
import * as factory from 'tods-competition-factory';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { coms } from 'services/coms';
import { env } from 'settings/env';

import { db } from './storage/db';

import { TOURNAMENT } from 'constants/tmxConstants';

export function setDev() {
  if (!window.dev && window.location.host.indexOf('localhost:3') === 0) {
    console.log('%c dev initialized', 'color: yellow');
    window.dev = {};
  }

  addDev({
    getTournament: () => factory.tournamentEngine.getState()?.tournamentRecord,
    tournamentEngine: factory.tournamentEngine,
    context: factory.setDevContext,
    modifyTournament,
    factory
  });
  addDev({ env, tournamentContext: context, db });
  addDev({ tmx2db, load, coms, getLoginState });
}

function addDev(variable) {
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
    if (tournamentId) {
      const displayTournament = () => context.router.navigate(`/${TOURNAMENT}/${tournamentId}`);
      addOrUpdateTournament({ tournamentRecord, callback: displayTournament });
    }
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
