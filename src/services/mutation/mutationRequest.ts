/**
 * Mutation request handler with server and local execution.
 * Handles tournament modifications with authentication and permission checks.
 */
import { isStale, resetActivityTimer } from 'services/staleness/stalenessGuard';
import { getLoginState, styleLogin } from 'services/authentication/loginState';
import { getUserContext } from 'services/authentication/getUserContext';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { tmxToast } from 'services/notifications/tmxToast';
import { emitTmx } from 'services/messaging/socketIo';
import { providerConfig } from 'config/providerConfig';
import * as factory from 'tods-competition-factory';
import { serverConfig } from 'config/serverConfig';
import { debugConfig } from 'config/debugConfig';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t } from 'i18n';
import dayjs from 'dayjs';

// types
import type { MutationMethod, ExecutionResult } from 'types/services';

// constants
import { SUPER_ADMIN, TOURNAMENT_ENGINE } from 'constants/tmxConstants';
import {
  ADD_PARTICIPANTS,
  DELETE_PARTICIPANTS,
  ADD_EVENT,
  DELETE_EVENTS,
  ADD_MATCHUP_SCHEDULE_ITEMS,
  BULK_SCHEDULE_MATCHUPS,
  ADD_VENUE,
  DELETE_VENUES,
  ADD_DRAW_DEFINITION,
  DELETE_DRAW_DEFINITIONS,
} from 'constants/mutationConstants';

interface MutationParams {
  tournamentRecord?: any;
  methods: MutationMethod[];
  engine?: string;
  callback?: (result: ExecutionResult) => void;
}

// ── Pure helpers (testable without DOM) ──

export function checkOfflineState(tournamentRecords: Record<string, any>): {
  offline: number;
  invalidOffline: boolean;
} {
  const getOffline = (record: any) =>
    record.timeItems?.find(({ itemType }: any) => itemType === 'TMX')?.itemValue?.offline;
  const offlineValues = Object.values(tournamentRecords).map(getOffline).filter(Boolean);
  const invalidOffline =
    offlineValues.length > 1 && !offlineValues.every((v: any) => !v.email || v.email === offlineValues[0].email);
  return { offline: offlineValues.length, invalidOffline };
}

export function applyDevOverrides(methods: MutationMethod[], devParams?: Record<string, any>): MutationMethod[] {
  if (!devParams) return methods;
  return methods.map((m) => (devParams[m.method] ? { ...m, params: { ...m.params, ...devParams[m.method] } } : m));
}

const LOCAL_ONLY = 'local-only';
const LOCAL_FIRST = 'local-first';
const SERVER_FIRST = 'server-first';
type ExecutionStrategy = typeof LOCAL_ONLY | typeof LOCAL_FIRST | typeof SERVER_FIRST;

export function determineExecutionStrategy(
  hasProvider: boolean,
  offline: boolean,
  serverFirst: boolean,
): ExecutionStrategy {
  if (!hasProvider || offline) return LOCAL_ONLY;
  if (!serverFirst) return LOCAL_FIRST;
  return SERVER_FIRST;
}

export async function mutationRequest(params: MutationParams): Promise<void> {
  if (isStale()) {
    const msg = 'Please refresh tournament data before making changes';
    tmxToast({ message: msg, intent: 'is-warning' });
    if (params.callback) params.callback({ error: { message: msg } });
    return;
  }
  resetActivityTimer();

  const { tournamentRecord, methods, engine = TOURNAMENT_ENGINE, callback } = params;
  const state = getLoginState();

  const completion = (result?: any): void => {
    if (tournamentRecord) factory[engine].reset();
    if (callback && isFunction(callback)) {
      callback(result);
    } else if (result?.error) {
      tmxToast({ message: result.error.message ?? t('common.error'), intent: 'is-danger' });
    }
  };

  if (!Array.isArray(methods)) return completion();
  const factoryEngine = factory[engine];
  if (!factoryEngine) return completion();

  // Provider-level mutation gating (defense-in-depth)
  const blocked = methods.find((m) => !isMutationAllowed(m.method));
  if (blocked) {
    return completion({ error: { message: `Action not permitted: ${blocked.method}` } });
  }

  if (tournamentRecord) factoryEngine.setState(tournamentRecord);

  const getProviderId = (tournamentRecord: any) => tournamentRecord?.parentOrganisation?.organisationId;
  const tournamentRecords = factoryEngine.getState()?.tournamentRecords ?? {};

  const { offline, invalidOffline } = checkOfflineState(tournamentRecords);
  if (invalidOffline) return tmxToast({ message: t('toasts.notAllOffline'), intent: 'is-danger' });

  const tournamentIds = Object.values(tournamentRecords)?.map((record: any) => record.tournamentId);
  const providerIds = factory.tools.unique(Object.values(tournamentRecords)?.map(getProviderId)).filter(Boolean);
  if (providerIds.length > 1) return tmxToast({ message: t('toasts.multipleProviders'), intent: 'is-danger' });

  const now = Date.now();
  const inDateRange = Object.values(tournamentRecords).every((record: any) => {
    const endTime = dayjs(record.endDate).endOf('day').valueOf();
    return !!(endTime && endTime >= now);
  });

  const mutate = (saveLocal?: boolean) =>
    makeMutation({ offline, methods, factoryEngine, tournamentIds, completion, saveLocal });
  if (!inDateRange) {
    queryDateRange({ state, providerIds, mutate });
    return;
  }
  if (providerIds.length && !offline && state) {
    checkPermissions({ state, providerIds, mutate });
    return;
  }
  await mutate(true);
}

function queryDateRange({
  state,
  providerIds,
  mutate,
}: {
  state: any;
  providerIds: string[];
  mutate: (saveLocal?: boolean) => Promise<void>;
}): void {
  const onClick = () => (providerIds?.length ? checkPermissions({ state, providerIds, mutate }) : mutate());
  return tmxToast({
    action: { onClick, text: 'Modify?' },
    message: t('toasts.notInDateRange'),
    intent: 'is-danger',
    pauseOnHover: true,
    duration: 8000,
  });
}

function checkPermissions({
  state,
  providerIds,
  mutate,
}: {
  state: any;
  providerIds: string[];
  mutate: (saveLocal?: boolean) => Promise<void>;
}): void {
  if (!state) {
    context.provider = undefined;
    styleLogin(false);
    return tmxToast({ message: t('toasts.notLoggedIn'), intent: 'is-warning' });
  }

  const targetProviderId = providerIds[0];

  // Use the multi-provider userContext if available (preferred source —
  // reflects current user_providers state without JWT staleness), falling
  // back to the legacy JWT fields for backwards compatibility.
  const userContext = getUserContext();
  const isProvider = userContext
    ? userContext.providerIds.includes(targetProviderId)
    : !!(state?.providerIds?.includes(targetProviderId) || state?.provider?.organisationId === targetProviderId);
  const isSuperAdmin = userContext ? userContext.isSuperAdmin : state?.roles?.includes(SUPER_ADMIN);
  const impersonating = context.provider?.organisationId === targetProviderId;

  if (!isProvider && !isSuperAdmin) return tmxToast({ message: t('toasts.notAuthorized'), intent: 'is-danger' });
  if (!isProvider && isSuperAdmin && !impersonating) {
    const impersonateProvider = () => {
      context.provider = { organisationId: targetProviderId };
      return mutate(false);
    };

    return tmxToast({
      action: {
        onClick: impersonateProvider,
        text: 'Impersonate?',
      },
      message: t('toasts.superAdmin'),
      intent: 'is-danger',
    });
  }

  const saveLocal = !isProvider && !(isSuperAdmin && impersonating);
  mutate(saveLocal);
}

function engineExecution({ factoryEngine, methods }: { factoryEngine: any; methods: any[] }): any {
  if (debugConfig.get().log?.verbose) console.log('%c executing locally', 'color: lightgreen');
  const directives = factory.tools.makeDeepCopy(methods);
  return factoryEngine.executionQueue(directives, true) || {};
}

async function localSave(saveLocal: boolean): Promise<void> {
  if (saveLocal || serverConfig.get().saveLocal) {
    await saveTournamentRecord({ forceSave: saveLocal });
  }
}

async function makeMutation({
  offline,
  methods,
  completion,
  factoryEngine,
  tournamentIds,
  saveLocal,
}: {
  offline: any;
  methods: any[];
  completion: (result?: any) => void;
  factoryEngine: any;
  tournamentIds: string[];
  saveLocal?: boolean;
}): Promise<void> {
  const hasProvider = !!factoryEngine.getTournament().tournamentRecord?.parentOrganisation?.organisationId;
  const resolvedMethods = applyDevOverrides(methods, window['dev']?.params);
  if (window?.['dev']?.getContext().internal) console.log({ methods: resolvedMethods });

  const strategy = determineExecutionStrategy(hasProvider, !!offline, serverConfig.get().serverFirst);

  let factoryResult: any;
  if (strategy === LOCAL_ONLY || strategy === LOCAL_FIRST) {
    factoryResult = engineExecution({ factoryEngine, methods: resolvedMethods });
    if (factoryResult.error) return completion(factoryResult);
    if (strategy === LOCAL_ONLY) {
      await localSave(true);
      return completion(factoryResult);
    }
  }

  if (hasProvider && (factoryResult?.success || strategy === SERVER_FIRST)) {
    let ackReceived = false;
    let timedOut = false;
    const ackCallback = (ack: any) => {
      if (timedOut) return;
      ackReceived = true;
      const missingTournament = ack?.error?.code === 'ERR_MISSING_TOURNAMENT';
      if (serverConfig.get().serverFirst && (ack?.success || missingTournament)) {
        (async () => {
          factoryResult = engineExecution({ factoryEngine, methods: resolvedMethods });
          if (factoryResult.error) return completion(factoryResult);
          await localSave(saveLocal || missingTournament);
          return completion(factoryResult);
        })();
      } else if (strategy === SERVER_FIRST) {
        completion(ack?.error ? ack : { error: { message: 'Server rejected mutation' } });
      }
    };
    if (debugConfig.get().log?.verbose) console.log('%c invoking remote', 'color: lightblue');
    emitTmx({
      data: { type: 'executionQueue', payload: { methods: resolvedMethods, tournamentIds, rollbackOnError: true } },
      ackCallback,
    });
    if (strategy === LOCAL_FIRST) {
      await localSave(saveLocal || false);
    } else {
      setTimeout(() => {
        if (ackReceived) return;
        timedOut = true;
        tmxToast({ message: t('toasts.serverNotResponding'), intent: 'is-danger' });
        completion({ error: { message: 'Server not responding' } });
      }, serverConfig.get().serverTimeout ?? 10000);
    }
  }

  if (strategy === LOCAL_FIRST) return completion(factoryResult);
}

// ── Provider mutation gating ──

/** Map of mutation method names to provider permission keys. */
const MUTATION_PERMISSION_MAP: Record<string, keyof import('config/providerConfig').ProviderPermissions> = {
  [ADD_PARTICIPANTS]: 'canCreateCompetitors',
  [DELETE_PARTICIPANTS]: 'canDeleteParticipants',
  [ADD_EVENT]: 'canCreateEvents',
  [DELETE_EVENTS]: 'canDeleteEvents',
  [ADD_MATCHUP_SCHEDULE_ITEMS]: 'canModifySchedule',
  [BULK_SCHEDULE_MATCHUPS]: 'canModifySchedule',
  [ADD_VENUE]: 'canCreateVenues',
  [DELETE_VENUES]: 'canDeleteVenues',
  [ADD_DRAW_DEFINITION]: 'canCreateDraws',
  [DELETE_DRAW_DEFINITIONS]: 'canDeleteDraws',
};

function isMutationAllowed(method: string): boolean {
  const permKey = MUTATION_PERMISSION_MAP[method];
  if (!permKey) return true; // Unmapped mutations are allowed by default
  return providerConfig.isAllowed(permKey);
}
