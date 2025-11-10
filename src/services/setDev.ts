/**
 * Development mode utilities and debugging tools.
 * Exposes factory methods and utilities on window.dev for debugging.
 */
import { getProviders, getUsers, requestTournament, sendTournament } from './apis/servicesApi';
import { exportTournamentRecord } from 'components/modals/exportTournamentRecord';
import { connectSocket, disconnectSocket, emitTmx } from './messaging/socketIo';
import { addOrUpdateTournament } from 'services/storage/addOrUpdateTournament';
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
import dayjs from 'dayjs';

import { TOURNAMENT } from 'constants/tmxConstants';

const subscriptions: Record<string, (results: any) => void> = {
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
  modifyTournamentDetail: (results) => functionOrLog('modifyTournamentDetail', results),
};

function functionOrLog(s: string, results: any): void {
  return typeof (window as any).dev?.subs?.[s] === 'function'
    ? (window as any).dev.subs[s](results)
    : ((window as any).dev.allSubscriptions || (window as any).dev.subs?.[s]) && console.log(s, results);
}

export function setDev(): void {
  if (!(window as any)['dev']) {
    console.log('%c dev initialized', 'color: yellow');
    (window as any).dev = {};
  } else {
    return;
  }

  const help = () => console.log('set window.socketURL for messaging');
  const modifyTournament = (methods: any[]) => {
    if (!Array.isArray(methods)) {
      tmxToast({ message: 'missing methods array', intent: 'is-danger' });
      return;
    }
    const tournamentId = factory.tournamentEngine.getTournament().tournamentRecord?.tournamentId;
    if (tournamentId) {
      const callback = (result: any) => {
        if (result?.success) {
          tmxToast({ message: 'success', intent: 'is-success' });
          const tournamentRecord = factory.tournamentEngine.getTournament().tournamentRecord;
          loadTournament({ tournamentRecord, config: { selectedTab: TOURNAMENT } });
        } else {
          tmxToast({ message: result?.error?.message ?? 'error', intent: 'is-danger' });
          console.log({ result });
        }
      };

      mutationRequest({ methods, callback });
    } else {
      tmxToast({ message: 'missing tournament', intent: 'is-danger' });
    }
  };

  const fetchTournament = (tournamentId: string) => {
    requestTournament({ tournamentId }).then((result: any) => {
      if (result?.error) {
        console.log({ error: result.error });
      } else {
        const tournamentRecord = result?.data?.tournamentRecords?.[tournamentId];
        if (tournamentRecord) loadTournament({ tournamentRecord, config: { selectedTab: TOURNAMENT } });
      }
    });
  };

  const subs = Object.assign({}, ...Object.keys(subscriptions).map((key) => ({ [key]: false })));

  addDev({
    getProviders,
    getProvider: (name: string) =>
      getProviders().then((result: any) =>
        console.log(
          result?.data?.providers.find((p: any) => p.value.organisationName.toLowerCase().includes(name.toLowerCase())),
        ),
      ),
    getTournament: () => factory.tournamentEngine.getTournament()?.tournamentRecord,
    getContext: factory.globalState.getDevContext,
    tournamentEngine: factory.tournamentEngine,
    context: factory.globalState.setDevContext,
    generateMockTournament,
    modifyTournament,
    fetchTournament,
    sendTournament,
    getLoginState,
    getUsers,
    factory,
    baseApi,
    dayjs,
    help,
    subs,
  });

  addDev({ connectSocket, disconnectSocket, emitTmx });
  addDev({ tmx2db, load, exportTournamentRecord });
  addDev({ env, tournamentContext: context });

  factory.globalState.setSubscriptions({ subscriptions });
}

function addDev(variable: Record<string, any>): void {
  if (!isObject((window as any).dev)) return;

  try {
    Object.keys(variable).forEach((key) => ((window as any).dev[key] = variable[key]));
  } catch (err) {
    tmxToast({ message: 'An error occurred while adding dev variables', intent: 'is-danger' });
    console.error('Error adding dev variables:', err);
  }
}

function load(json: any): void {
  if (typeof json === 'object') {
    const tournamentRecord = json.tournamentRecord || json;
    const tournamentId = tournamentRecord?.tournamentId;
    if (tournamentId) addAndDisplay(tournamentRecord);
  }
}

function generateMockTournament(params: any): void {
  const { tournamentRecord, error } = factory.mocksEngine.generateTournamentRecord(params);
  if (error) {
    console.log({ error });
  } else {
    addAndDisplay(tournamentRecord);
  }
}

function addAndDisplay(tournamentRecord: any): void {
  const tournamentId = tournamentRecord?.tournamentId;
  const displayTournament = () => context.router.navigate(`/${TOURNAMENT}/${tournamentId}`);
  addOrUpdateTournament({ tournamentRecord, callback: displayTournament });
}
