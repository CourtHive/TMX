import { exportTournamentRecord } from 'components/modals/exportTournamentRecord';
import { connectSocket, disconnectSocket, emitTmx } from './messaging/socketIo';
import { addOrUpdateTournament } from 'services/storage/addOrUpdateTournament';
import { getProviders, requestTournament } from './apis/servicesApi';
import { loadTournament } from 'pages/tournament/tournamentDisplay';
import { mutationRequest } from './mutation/mutationRequest';
import { getLoginState } from './authentication/loginState';
import * as factory from 'tods-competition-factory';
import { tmxToast } from './notifications/tmxToast';
import { tmx2db } from 'services/storage/tmx2db';
import { isObject } from 'functions/typeOf';
import { context } from 'services/context';
import { baseApi } from './apis/baseApi';
import { env } from 'settings/env';

import { TOURNAMENT } from 'constants/tmxConstants';
import dayjs from 'dayjs';

function functionOrLog(s, results) {
  return typeof window.dev[s] === 'function'
    ? window.dev[s](results)
    : // eslint-disable-next-line no-console
      (window.dev.allSubscriptions || window.dev[s]) && console.log(s, results);
}

const subscriptions = {
  addDrawDefinition: (results) => functionOrLog('addDrawDefinition', results),
  addMatchUps: (results) => functionOrLog('addMatchUps', results),
  addParticipants: (results) => functionOrLog('addParticipants', results),
  addVenue: (results) => functionOrLog('addVenue', results),
  deletedDrawIds: (results) => functionOrLog('deletedDrawIds', results),
  deletedMatchUpIds: (results) => functionOrLog('deletedMatchUpIds', results),
  deleteVenue: (results) => functionOrLog('deleteVenue', results),
  modifyDrawDefinition: (results) => functionOrLog('modifyDrawDefinition', results),
  modifyDrawEntries: (results) => functionOrLog('modifyDrawEntries', results),
  modifyEventEntries: (results) => functionOrLog('modifyEventEntries', results),
  modifyMatchUp: (results) => functionOrLog('modifyMatchUp', results),
  modifyParticipants: (results) => functionOrLog('modifyParticipants', results),
  modifyPositionAssignments: (results) => functionOrLog('modifyPositionAssignments', results),
  modifySeedAssignments: (results) => functionOrLog('modifySeedAssignments', results),
  modifyVenue: (results) => functionOrLog('modifyVenue', results),
  publishEvent: (results) => functionOrLog('publishEvent', results),
  publishEventSeeding: (results) => functionOrLog('publishEventSeeding', results),
  publishOrderOfPlay: (results) => functionOrLog('publishOrderOfPlay', results),
  unPublishEvent: (results) => functionOrLog('unPublishEvent', results),
  unPublishEventSeeding: (results) => functionOrLog('unPublishEventSeeding', results),
  unPublishOrderOfPlay: (results) => functionOrLog('unPublishOrderOfPlay', results),
  updateInContextMatchUp: (results) => functionOrLog('updateInContextMatchUp', results),
};

export function setDev() {
  if (!window['dev']) {
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
    const tournamentId = factory.tournamentEngine.getTournament().tournamentRecord?.tournamentId;
    if (tournamentId) {
      const callback = (result) => {
        if (result?.success) {
          tmxToast({ message: 'success', intent: 'is-success' });
          const tournamentRecord = factory.tournamentEngine.getTournament().tournamentRecord;
          const displayTournament = () => loadTournament({ tournamentRecord, config: { selectedTab: TOURNAMENT } });
          addOrUpdateTournament({ tournamentRecord, callback: displayTournament });
        } else {
          tmxToast({ message: result?.error?.message ?? 'error', intent: 'is-danger' });
          // eslint-disable-next-line no-console
          console.log({ result });
        }
      };

      mutationRequest({ methods, callback });
    } else {
      tmxToast({ message: 'missing tournament', intent: 'is-danger' });
    }
  };

  const fetchTournament = (tournamentId) => {
    requestTournament({ tournamentId }).then((result) => {
      if (result?.error) {
        console.log({ error: result.error });
      } else {
        const tournamentRecord = result?.data?.tournamentRecords?.[tournamentId];
        tournamentRecord && addAndDisplay(tournamentRecord);
      }
    });
  };

  addDev({
    getProviders: () => getProviders().then((result) => console.log(result?.data?.providers)),
    getProvider: (name) =>
      getProviders().then((result) =>
        console.log(
          result?.data?.providers.find((p) => p.value.organisationName.toLowerCase().includes(name.toLowerCase())),
        ),
      ),
    getTournament: () => factory.tournamentEngine.getTournament()?.tournamentRecord,
    getContext: factory.globalState.getDevContext,
    tournamentEngine: factory.tournamentEngine,
    context: factory.globalState.setDevContext,
    generateMockTournament,
    modifyTournament,
    fetchTournament,
    getLoginState,
    factory,
    baseApi,
    dayjs,
    help,
  });

  addDev({ connectSocket, disconnectSocket, emitTmx });
  addDev({ tmx2db, load, exportTournamentRecord });
  addDev({ env, tournamentContext: context });

  factory.globalState.setSubscriptions({ subscriptions });
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
