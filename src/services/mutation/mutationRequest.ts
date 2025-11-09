/**
 * Mutation request handler with server and local execution.
 * Handles tournament modifications with authentication and permission checks.
 */
import { getLoginState, styleLogin } from 'services/authentication/loginState';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { tmxToast } from 'services/notifications/tmxToast';
import { emitTmx } from 'services/messaging/socketIo';
import * as factory from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { env } from 'settings/env';
import dayjs from 'dayjs';

import { SUPER_ADMIN, TOURNAMENT_ENGINE } from 'constants/tmxConstants';

interface MutationParams {
  tournamentRecord?: any;
  methods: any[];
  engine?: string;
  callback?: (result: any) => void;
}

export async function mutationRequest(params: MutationParams): Promise<void> {
  const { tournamentRecord, methods, engine = TOURNAMENT_ENGINE, callback } = params;
  const state = getLoginState();

  const completion = (result?: any): void => {
    if (tournamentRecord) factory[engine].reset();
    if (callback && isFunction(callback)) {
      callback(result);
    } else if (result?.error) {
      tmxToast({ message: result.error.message ?? 'Error', intent: 'is-danger' });
    }
  };

  if (!Array.isArray(methods)) return completion();
  const factoryEngine = factory[engine];
  if (!factoryEngine) return completion();

  if (tournamentRecord) factoryEngine.setState(tournamentRecord);

  const getProviderId = (tournamentRecord: any) => tournamentRecord?.parentOrganisation?.organisationId;
  const tournamentRecords = factoryEngine.getState()?.tournamentRecords ?? {};

  const getOffline = (tournamentRecord: any) =>
    tournamentRecord.timeItems?.find(({ itemType }: any) => itemType === 'TMX')?.itemValue?.offline;

  const offlineValues = Object.values(tournamentRecords)?.map(getOffline).filter(Boolean);
  const invalidOffline =
    offlineValues.length > 1 && !offlineValues.every((v: any) => !v.email || v.email === offlineValues[0].email);
  if (invalidOffline) return tmxToast({ message: 'Not all linked tournaments are offline', intent: 'is-danger' });
  const offline = offlineValues.length;

  const tournamentIds = Object.values(tournamentRecords)?.map((record: any) => record.tournamentId);
  const providerIds = factory.tools.unique(Object.values(tournamentRecords)?.map(getProviderId)).filter(Boolean);
  if (providerIds.length > 1) return tmxToast({ message: 'Multiple providers', intent: 'is-danger' });

  const now = new Date().getTime();
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
  if (providerIds.length && !offline) {
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
  mutate: (saveLocal?: boolean) => void;
}): void {
  const onClick = () => (providerIds?.length ? checkPermissions({ state, providerIds, mutate }) : mutate());
  return tmxToast({
    action: { onClick, text: 'Modify?' },
    message: 'Not in date range',
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
  mutate: (saveLocal?: boolean) => void;
}): void {
  if (!state) {
    context.provider = undefined;
    styleLogin(false);
    return tmxToast({ message: 'Not logged in', intent: 'is-warning' });
  }

  const isProvider = !!(
    state?.providerIds?.includes(providerIds[0]) || state?.provider?.organisationId === providerIds[0]
  );
  const isSuperAdmin = state?.roles?.includes(SUPER_ADMIN);
  const impersonating = context.provider?.organisationId === providerIds[0];

  if (!isProvider && !isSuperAdmin) return tmxToast({ message: 'Not authorized', intent: 'is-danger' });
  if (!isProvider && isSuperAdmin && !impersonating) {
    const impersonateProvider = () => {
      context.provider = { organisationId: providerIds[0] };
      return mutate(false);
    };

    return tmxToast({
      action: {
        onClick: impersonateProvider,
        text: 'Impersonate?',
      },
      message: 'Super Admin',
      intent: 'is-danger',
    });
  }

  const saveLocal = !isProvider && !(isSuperAdmin && impersonating);
  return mutate(saveLocal);
}

function engineExecution({ factoryEngine, methods }: { factoryEngine: any; methods: any[] }): any {
  if (env.log?.verbose) console.log('%c executing locally', 'color: lightgreen');
  const directives = factory.tools.makeDeepCopy(methods);
  return factoryEngine.executionQueue(directives, true) || {};
}

async function localSave(saveLocal: boolean): Promise<void> {
  if (saveLocal || env.saveLocal) {
    await saveTournamentRecord();
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
  const hasProvider = factoryEngine.getTournament().tournamentRecord?.parentOrganisation?.organisationId;
  if (window['dev']?.params) {
    for (const method of methods) {
      if (window['dev'].params[method.method]) {
        method.params = { ...method.params, ...window['dev'].params[method.method] };
      }
    }
  }

  if (window?.['dev']?.getContext().internal) console.log({ methods });

  const executeLocalFirst = !env.serverFirst || !hasProvider;

  let factoryResult: any;
  if (executeLocalFirst || offline) {
    factoryResult = engineExecution({ factoryEngine, methods });
    if (factoryResult.error) return completion(factoryResult);
    if (!hasProvider || offline) {
      await localSave(true);
      return completion(factoryResult);
    }
  }

  if (hasProvider && (factoryResult?.success || env.serverFirst)) {
    const ackCallback = async (ack: any) => {
      const missingTournament = ack?.error?.code === 'ERR_MISSING_TOURNAMENT';
      if (env.serverFirst && (ack?.success || missingTournament)) {
        factoryResult = engineExecution({ factoryEngine, methods });
        if (factoryResult.error) return completion(factoryResult);
        await localSave(saveLocal || missingTournament);
        return completion(factoryResult);
      }
    };
    if (env.log?.verbose) console.log('%c invoking remote', 'color: lightblue');
    emitTmx({
      data: { type: 'executionQueue', payload: { methods, tournamentIds, rollbackOnError: true } },
      ackCallback,
    });
    if (executeLocalFirst) await localSave(saveLocal || false);
  }

  if (executeLocalFirst) return completion(factoryResult);
}
