import { exportTournamentRecord } from 'components/modals/exportTournamentRecord';
import { connectSocket, disconnectSocket, emitTmx } from './messaging/socketIo';
import { addOrUpdateTournament } from 'services/storage/addTournament';
import { loadTournament } from 'Pages/Tournament/tournamentDisplay';
import { mutationRequest } from './mutation/mutationRequest';
import { getLoginState } from './authentication/loginState';
import * as factory from 'tods-competition-factory';
import { tmx2db } from 'services/storage/tmx2db';
import { isObject } from 'functions/typeOf';
import { context } from 'services/context';
import { env } from 'settings/env';

import { TOURNAMENT } from 'constants/tmxConstants';
import { tmxToast } from './notifications/tmxToast';

function functionOrLog(s, results) {
  return typeof window.dev[s] === 'function'
    ? window.dev[s](results)
    : // eslint-disable-next-line no-console
      (window.dev.allSubscriptions || window.dev[s]) && console.log(s, results);
}

const subscriptions = {
  addDrawDefinition: (results) => functionOrLog('addDrawDefinition', results),
  deletedDrawIds: (results) => functionOrLog('deletedDrawIds', results),
  addVenue: (results) => functionOrLog('addVenue', results),
  deleteVenue: (results) => functionOrLog('deleteVenue', results),
  modifyMatchUp: (results) => functionOrLog('modifyMatchUp', results),
  addMatchUps: (results) => functionOrLog('addMatchUps', results),
  deletedMatchUpIds: (results) => functionOrLog('deletedMatchUpIds', results),
  publishEvent: (results) => functionOrLog('publishEvent', results),
  unPublishEvent: (results) => functionOrLog('unPublishEvent', results),
  publishEventSeeding: (results) => functionOrLog('publishEventSeeding', results),
  unPublishEventSeeding: (results) => functionOrLog('unPublishEventSeeding', results),
  modifyDrawEntries: (results) => functionOrLog('modifyDrawEntries', results),
  modifyEventEntries: (results) => functionOrLog('modifyEventEntries', results),
  modifyDrawDefinition: (results) => functionOrLog('modifyDrawDefinition', results),
  modifyParticipants: (results) => functionOrLog('modifyParticipants', results),
  modifyVenue: (results) => functionOrLog('modifyVenue', results),
  modifySeedAssignments: (results) => functionOrLog('modifySeedAssignments', results),
  modifyPositionAssignments: (results) => functionOrLog('modifyPositionAssignments', results)
};

export function setDev() {
  if (!window.dev) {
    // eslint-disable-next-line no-console
    console.log('%c dev initialized', 'color: yellow');
    window.dev = {};
  } else {
    return;
  }

  const help = () => console.log('set window.socketURL for messaging');
  const modifyTournament = (methods) => {
    if (!Array.isArray(methods)) {
      tmxToast({ message: 'missing methods array', intent: 'is-danger' });
      return;
    }
    const tournamentId = factory.tournamentEngine.getState().tournamentRecord?.tournamentId;
    if (tournamentId) {
      const callback = (result) => {
        if (result?.success) {
          tmxToast({ message: 'success', intent: 'is-success' });
          const tournamentRecord = factory.tournamentEngine.getState().tournamentRecord;
          const displayTournament = () => loadTournament({ tournamentRecord, config: { selectedTab: TOURNAMENT } });
          addOrUpdateTournament({ tournamentRecord, callback: displayTournament });
        } else {
          tmxToast({ message: result?.error?.message ?? 'error', intent: 'is-danger' });
          // eslint-disable-next-line no-console
          console.log(result);
        }
      };

      mutationRequest({ methods, callback });
    } else {
      tmxToast({ message: 'missing tournament', intent: 'is-danger' });
    }
  };

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

  factory.setSubscriptions({ subscriptions });
}

function addDev(variable) {
  if (!isObject(window.dev)) return;

  try {
    Object.keys(variable).forEach((key) => (window.dev[key] = variable[key]));
  } catch (err) {
    // eslint-disable-next-line no-console
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

function generateMockTournament(params) {
  const { tournamentRecord, error } = factory.mocksEngine.generateTournamentRecord(params);
  if (error) {
    // eslint-disable-next-line no-console
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
