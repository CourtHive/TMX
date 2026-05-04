/**
 * Development mode utilities and debugging tools.
 * Exposes factory methods and utilities on globalThis.dev for debugging.
 */
import { getProviders, getUsers, requestTournament, sendTournament } from './apis/servicesApi';
import { exportTournamentRecord } from 'components/modals/exportTournamentRecord';
import { connectSocket, disconnectSocket, emitTmx } from './messaging/socketIo';
import { addOrUpdateTournament } from 'services/storage/addOrUpdateTournament';
import { forceStalenessOverlay } from 'services/staleness/stalenessGuard';
import { loadTournament } from 'pages/tournament/tournamentDisplay';
import { baseApi, setBaseURL, getBaseURL } from './apis/baseApi';
import { completeMatchUps } from 'services/devCompleteMatchUps';
import { mutationRequest } from './mutation/mutationRequest';
import { getLoginState } from './authentication/loginState';
import { providerConfig } from 'config/providerConfig';
import * as factory from 'tods-competition-factory';
import { tmxToast } from './notifications/tmxToast';
import { tmx2db } from 'services/storage/tmx2db';
import { serverConfig } from 'config/serverConfig';
import { isObject } from 'functions/typeOf';
import { context } from 'services/context';
import { env } from 'settings/env';
import { t } from 'i18n';
import dayjs from 'dayjs';

// constants
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
  return typeof (globalThis as any).dev?.subs?.[s] === 'function'
    ? (globalThis as any).dev.subs[s](results)
    : ((globalThis as any).dev.allSubscriptions || (globalThis as any).dev.subs?.[s]) && console.log(s, results);
}

export function setDev(): void {
  if ((globalThis as any)['dev']) {
    return;
  } else {
    console.log('%c dev initialized', 'color: yellow');
    (globalThis as any).dev = {};
  }

  const help = () => console.log('set globalThis.socketURL for messaging');
  const modifyTournament = (methods: any[]) => {
    if (!Array.isArray(methods)) {
      tmxToast({ message: t('toasts.missingMethodsArray'), intent: 'is-danger' });
      return;
    }
    const tournamentId = factory.tournamentEngine.getTournament().tournamentRecord?.tournamentId;
    if (tournamentId) {
      const callback = (result: any) => {
        if (result?.success) {
          tmxToast({ message: t('common.success'), intent: 'is-success' });
          const tournamentRecord = factory.tournamentEngine.getTournament().tournamentRecord;
          loadTournament({ tournamentRecord, config: { selectedTab: TOURNAMENT } });
        } else {
          tmxToast({ message: result?.error?.message ?? t('common.error'), intent: 'is-danger' });
          console.log({ result });
        }
      };

      mutationRequest({ methods, callback });
    } else {
      tmxToast({ message: t('toasts.missingTournament'), intent: 'is-danger' });
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

  addDev({
    mutationRequest: (params: any) => {
      const tournamentId = factory.tournamentEngine.getTournament().tournamentRecord?.tournamentId;
      if (!tournamentId) {
        tmxToast({ message: t('toasts.missingTournament'), intent: 'is-danger' });
        return;
      }
      return mutationRequest(params);
    },
  });

  addDev({ completeMatchUps, forceStalenessOverlay });
  addDev({ providerConfig });
  addDev({
    openFormatWizard: () => {
      const tournamentId = factory.tournamentEngine.getTournament().tournamentRecord?.tournamentId;
      if (!tournamentId) {
        console.warn('[dev.openFormatWizard] no tournament loaded');
        return;
      }
      context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/format-wizard`);
    },
    // Backward-compat alias for the previous modal-era API.
    openFormatWizardModal: () => {
      const tournamentId = factory.tournamentEngine.getTournament().tournamentRecord?.tournamentId;
      if (!tournamentId) {
        console.warn('[dev.openFormatWizardModal] no tournament loaded');
        return;
      }
      context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/format-wizard`);
    },
  });

  addDev({
    setServer: (url: string) => {
      setBaseURL(url);
      serverConfig.set({ socketPath: url });
      disconnectSocket();
      console.log(`[dev] server set to: ${url} — call dev.connectSocket() after logging in`);
    },
    goLocal: (port = 8383) => {
      const url = `http://localhost:${port}`;
      (globalThis as any).dev.setServer(url);
    },
    getServer: () => getBaseURL(),
  });

  factory.globalState.setSubscriptions({ subscriptions });
}

function addDev(variable: Record<string, any>): void {
  if (!isObject((globalThis as any).dev)) return;

  try {
    Object.keys(variable).forEach((key) => ((globalThis as any).dev[key] = variable[key]));
  } catch (err) {
    tmxToast({ message: t('toasts.devVariableError'), intent: 'is-danger' });
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
  const displayTournament = () => context.router?.navigate(`/${TOURNAMENT}/${tournamentId}`);
  addOrUpdateTournament({ tournamentRecord, callback: displayTournament });
}
