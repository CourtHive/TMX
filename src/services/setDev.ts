/**
 * Development mode utilities and debugging tools.
 * Exposes factory methods and utilities on globalThis.dev for debugging.
 */
import { forceStaleness, isStale, triggerStalenessCheck } from 'services/staleness/stalenessGuard';
import { getProviders, getUsers, requestTournament, sendTournament } from './apis/servicesApi';
import { loadTournament, renderTournament } from 'pages/tournament/tournamentDisplay';
import { exportTournamentRecord } from 'components/modals/exportTournamentRecord';
import { connectSocket, disconnectSocket, emitTmx, simulateFacilityScheduleChanged } from './messaging/socketIo';
import { addOrUpdateTournament } from 'services/storage/addOrUpdateTournament';
import { teamProfileModal } from 'components/modals/teamProfileModal';
import { buildFromSources } from '../dev/cfsToTournamentRecord.mjs';
import { baseApi, setBaseURL, getBaseURL } from './apis/baseApi';
import { completeMatchUps } from 'services/devCompleteMatchUps';
import { mutationRequest } from './mutation/mutationRequest';
import { getLoginState } from './authentication/loginState';
import { setScoreRelayURL } from './apis/scoreRelayApi';
import { providerConfig } from 'config/providerConfig';
import * as factory from 'tods-competition-factory';
import { tmxToast } from './notifications/tmxToast';
import { serverConfig } from 'config/serverConfig';
import { tmx2db } from 'services/storage/tmx2db';
import { isObject } from 'functions/typeOf';
import { context } from 'services/context';
import { env } from 'settings/env';
import dayjs from 'dayjs';
import { t } from 'i18n';

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
  }
  (globalThis as any).dev = {};

  const help = () => console.log('set globalThis.socketURL for messaging');
  const modifyTournament = (methods: any[]) => {
    if (!Array.isArray(methods)) {
      tmxToast({ message: t('toasts.missingMethodsArray'), intent: 'is-danger' });
      return;
    }
    const tournamentId = factory.tournamentEngine.q.tournament()?.tournamentId;
    if (tournamentId) {
      const callback = (result: any) => {
        if (result?.success) {
          tmxToast({ message: t('common.success'), intent: 'is-success' });
          const tournamentRecord = factory.tournamentEngine.q.tournament();
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
    getTournament: () => factory.tournamentEngine.q.tournament(),
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

  addDev({ connectSocket, disconnectSocket, emitTmx, simulateFacilityScheduleChanged });
  addDev({ tmx2db, load, build, exportTournamentRecord });
  addDev({ env, tournamentContext: context });

  addDev({
    mutationRequest: (params: any) => {
      const tournamentId = factory.tournamentEngine.q.tournament()?.tournamentId;
      if (!tournamentId) {
        tmxToast({ message: t('toasts.missingTournament'), intent: 'is-danger' });
        return;
      }
      return mutationRequest(params);
    },
  });

  addDev({
    openTeamProfile: (participantId: string) => teamProfileModal({ participantId }),
  });

  addDev({ completeMatchUps, forceStaleness, isStale, triggerStalenessCheck });
  addDev({ providerConfig });
  addDev({
    openFormatWizard: () => {
      const tournamentId = factory.tournamentEngine.q.tournament()?.tournamentId;
      if (!tournamentId) {
        console.warn('[dev.openFormatWizard] no tournament loaded');
        return;
      }
      context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/format-wizard`);
    },
    // Backward-compat alias for the previous modal-era API.
    openFormatWizardModal: () => {
      const tournamentId = factory.tournamentEngine.q.tournament()?.tournamentId;
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
    // Point the score-relay REST client at a URL (enables the crowd poller +
    // crowd-trackers modal). Used by e2e to drive a route-mocked relay.
    setScoreRelayURL: (url: string) => setScoreRelayURL(url),
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

function load(json: any): Promise<void> | void {
  if (typeof json !== 'object') return;
  const tournamentRecord = json.tournamentRecord || json;
  const tournamentId = tournamentRecord?.tournamentId;
  if (!tournamentId) return;
  // Always seed the engine so renderTournament() can resolve sides even when
  // saveTournamentRecord short-circuits (parentOrganisation + saveLocal=false).
  // Without this, navigation to the tournament finds an empty engine and
  // re-fetches via tmx2db, which returns nothing — tabs render with no data.
  factory.tournamentEngine.setState(tournamentRecord);
  if (tournamentRecord.parentOrganisation?.organisationId && !serverConfig.get().saveLocal) {
    console.log(
      '%c[dev.load] session-only — not persisted to IndexedDB (parentOrganisation present + saveLocal off)',
      'color: orange',
    );
  }
  // Return the promise so callers (e.g. e2e seedTournament) can await the
  // deferred renderTournament + router.navigate callback before issuing
  // their own navigation — otherwise the late-firing callback races with
  // the test's next page.goto and snaps the page back to the overview.
  return addAndDisplay(tournamentRecord);
}

// Reverse-engineer a tournamentRecord from CFS public-API responses pasted
// into the console, then hand off to the same `load` path. Sources can be
// any combination of `getEventData`, `competitionScheduleMatchUps`, and
// `getParticipants` responses — kind is auto-detected. `{ data: { ... } }`
// envelopes (network-tab copies) are peeled automatically.
//
//   const t = { ... };  // getEventData response
//   const b = { ... };  // competitionScheduleMatchUps response
//   const x = { ... };  // getParticipants response
//   dev.build([t, b, x]);
function build(sources: any): any {
  if (!Array.isArray(sources)) {
    console.error('[dev.build] expected an array of sources (e.g. dev.build([a, b, c])); got', typeof sources);
    return undefined;
  }
  if (sources.length === 0) {
    console.warn('[dev.build] no sources passed');
    return undefined;
  }
  const { record, classification, unknownCount } = buildFromSources(sources);
  console.log(
    `[dev.build] classified ${classification.length} source(s):`,
    classification.map((c: any) => `${c.index}:${c.kind}`).join(', '),
  );
  if (unknownCount > 0) {
    console.warn(`[dev.build] could not classify ${unknownCount} source(s) — they were skipped`);
  }
  if (!record?.tournamentId) {
    console.error('[dev.build] built record has no tournamentId — returning it without loading; inspect to diagnose');
    return record;
  }
  load(record);
  return record;
}

function generateMockTournament(params: any): void {
  const { tournamentRecord, error } = factory.mocksEngine.generateTournamentRecord(params);
  if (error) {
    console.log({ error });
  } else {
    addAndDisplay(tournamentRecord);
  }
}

function addAndDisplay(tournamentRecord: any): Promise<void> {
  const tournamentId = tournamentRecord?.tournamentId;
  const displayTournament = () => {
    // Render full tournament view (header + tabs + side effects) so a paste loaded
    // via dev.load doesn't land on the engine-match short path that skips tournamentHeader().
    renderTournament({ config: { tournamentId } });
    context.router?.navigate(`/${TOURNAMENT}/${tournamentId}`);
  };
  return addOrUpdateTournament({ tournamentRecord, callback: displayTournament });
}
