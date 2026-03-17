/**
 * Development mode utilities and debugging tools.
 * Exposes factory methods and utilities on globalThis.dev for debugging.
 */
import { getProviders, getUsers, requestTournament, sendTournament } from './apis/servicesApi';
import { exportTournamentRecord } from 'components/modals/exportTournamentRecord';
import { connectSocket, disconnectSocket, emitTmx } from './messaging/socketIo';
import { addOrUpdateTournament } from 'services/storage/addOrUpdateTournament';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { loadTournament } from 'pages/tournament/tournamentDisplay';
import { baseApi, setBaseURL, getBaseURL } from './apis/baseApi';
import { mutationRequest } from './mutation/mutationRequest';
import { getLoginState } from './authentication/loginState';
import * as factory from 'tods-competition-factory';
import { tmxToast } from './notifications/tmxToast';
import { tmx2db } from 'services/storage/tmx2db';
import { isObject } from 'functions/typeOf';
import { providerConfig } from 'config/providerConfig';
import { serverConfig } from 'config/serverConfig';
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

  // Complete all incomplete matchUps in the currently viewed structure.
  // Auto-detects drawId/structureId from the URL hash.
  // For elimination structures, loops until no more matchUps can be completed (with failsafe).
  // Stops at lucky draw boundaries (does not auto-resolve lucky loser selections).
  addDev({
    completeMatchUps: ({ drawId, structureId }: { drawId?: string; structureId?: string } = {}) => {
      const te = factory.tournamentEngine;

      // Auto-detect from current route: .../draw/:drawId/structure/:structureId
      if (!drawId || !structureId) {
        const hash = globalThis.location.hash.replace('#/', '').split('/');
        const drawIdx = hash.indexOf('draw');
        const structIdx = hash.indexOf('structure');
        if (!drawId && drawIdx >= 0) drawId = hash[drawIdx + 1];
        if (!structureId && structIdx >= 0) structureId = hash[structIdx + 1];
      }

      if (!drawId) return console.log('No drawId — navigate to a draw view first');

      // Resolve structureId: fall back to first structure in draw when not in URL
      if (!structureId) {
        const eventData = te.getEventData({ drawId })?.eventData;
        const drawData = eventData?.drawsData?.find((d: any) => d.drawId === drawId);
        structureId = drawData?.structures?.[0]?.structureId;
        if (!structureId) return console.log('No structure found in draw');
      }

      // For CONTAINER structures (round robin), collect child structure IDs
      // since matchUps belong to child groups, not the container itself
      const { drawDefinition } = te.getEvent({ drawId });
      const structure = drawDefinition?.structures?.find((s: any) => s.structureId === structureId);
      const filterStructureIds = structure?.structures?.length
        ? structure.structures.map((s: any) => s.structureId)
        : [structureId];

      // Check if this is a lucky draw — stop before requiring lucky loser decisions
      const luckyStatus = te.getLuckyDrawRoundStatus({ drawId });
      const isLucky = luckyStatus?.isLuckyDraw;

      const getStructureMatchUps = () => {
        const result = te.allDrawMatchUps({ drawId, inContext: true }) || {};
        const all = result.matchUps || [];
        return all.filter((m: any) => !m.isCollectionMatchUp && filterStructureIds.includes(m.structureId));
      };

      const completeOnePass = (): number => {
        const incomplete = getStructureMatchUps().filter(
          (m: any) => m.readyToScore && !m.winningSide && m.matchUpStatus !== 'BYE',
        );

        let completed = 0;
        for (const m of incomplete) {
          const { outcome } = factory.mocksEngine.generateOutcome({
            matchUpFormat: m.matchUpFormat || drawDefinition?.matchUpFormat,
            matchUpStatusProfile: {},
            winningSide: 1,
          });
          if (!outcome) continue;

          const result = te.setMatchUpStatus({
            matchUpId: m.matchUpId,
            drawId,
            outcome,
          });
          if (result.success) completed++;
        }
        return completed;
      };

      // Check that all positions are assigned before attempting elimination looping
      const allStructureMatchUps = getStructureMatchUps();
      const isRoundRobin = allStructureMatchUps.some((m: any) => m.isRoundRobin);
      const hasUnassigned = allStructureMatchUps.some(
        (m: any) => !m.winningSide && m.matchUpStatus !== 'BYE' && !m.readyToScore,
      );

      if (!isRoundRobin && hasUnassigned) {
        console.log('Not all positions are assigned — cannot loop through elimination rounds');
      }

      let totalCompleted = 0;
      const MAX_PASSES = 20;

      // RR: single pass (all pairings known). Elimination: loop with failsafe.
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const completed = completeOnePass();
        totalCompleted += completed;

        if (completed === 0) break;
        if (isRoundRobin) break;
        if (isLucky) {
          console.log('Lucky draw — stopping before lucky loser selection');
          break;
        }
      }

      if (!totalCompleted) return console.log('No incomplete matchUps with both participants');
      console.log(`Completed ${totalCompleted} matchUps`);

      // Persist and re-render the current draw view
      const tournamentRecord = te.getTournament().tournamentRecord;
      if (tournamentRecord) {
        addOrUpdateTournament({
          tournamentRecord,
          callback: () => {
            const eventId = getEventIdFromHash();
            // Navigo won't re-trigger if the hash is unchanged, so force by
            // navigating away momentarily then back to the draw view.
            navigateToEvent({ eventId });
            navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
          },
        });
      }
    },
  });
  addDev({ providerConfig });

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

function getEventIdFromHash(): string | undefined {
  const hash = globalThis.location.hash.replace('#/', '').split('/');
  const idx = hash.indexOf('event');
  return idx >= 0 ? hash[idx + 1] : undefined;
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
