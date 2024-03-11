import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { getLoginState } from 'services/authentication/loginState';
import { tmxToast } from 'services/notifications/tmxToast';
import { emitTmx } from 'services/messaging/socketIo';
import * as factory from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { env } from 'settings/env';
import dayjs from 'dayjs';

import { SUPER_ADMIN, TOURNAMENT_ENGINE } from 'constants/tmxConstants';

export async function mutationRequest(params) {
  const { tournamentRecord, methods, engine = TOURNAMENT_ENGINE, callback } = params;
  const completion = (result) => {
    if (tournamentRecord) factory[engine].reset();
    if (isFunction(callback)) {
      callback(result);
    } else {
      console.log({ result });
    }
  };

  if (!Array.isArray(methods)) return completion();
  const factoryEngine = factory[engine];
  if (!factoryEngine) return completion();

  if (tournamentRecord) factoryEngine.setState(tournamentRecord);

  const getProviderId = (tournamentRecord) => tournamentRecord?.parentOrganisation?.organisationId;
  const tournamentRecords = factoryEngine.getState()?.tournamentRecords ?? {};

  const tournamentIds =
    engine === TOURNAMENT_ENGINE
      ? [factoryEngine.getTournamentId()]
      : Object.values(tournamentRecords)?.map((record) => record.tournamentId);
  const providerIds = factory.tools
    .unique(
      engine === TOURNAMENT_ENGINE
        ? [getProviderId(factoryEngine.getTournament().tournamentRecord)]
        : Object.values(tournamentRecords)?.map(getProviderId),
    )
    .filter(Boolean);
  if (providerIds.length > 1) return tmxToast({ message: 'Multiple providers', intent: 'is-danger' });

  const now = new Date().getTime();
  const inDateRange = Object.values(tournamentRecords).every((record) => {
    // const startTime = dayjs(record.startDate).startOf('day').valueOf();
    const endTime = dayjs(record.endDate).endOf('day').valueOf();
    return endTime && endTime >= now;
  });

  const mutate = (saveLocal) => makeMutation({ methods, factoryEngine, tournamentIds, completion, saveLocal });
  if (!inDateRange) return queryDateRange({ providerIds, mutate });
  if (providerIds.length) return checkPermissions({ providerIds, mutate });
  return mutate();
}

function queryDateRange({ providerIds, mutate }) {
  const onClick = () => (providerIds?.length ? checkPermissions({ providerIds, mutate }) : mutate());
  return tmxToast({
    action: { onClick, text: 'Modify?' },
    message: 'Not in date range',
    intent: 'is-danger',
  });
}

function checkPermissions({ providerIds, mutate }) {
  const state = getLoginState();
  // if the tournamentRecord(s) are associated with a providerId, check permissions
  if (!state) return tmxToast({ message: 'Not logged in', intent: 'is-warning' });

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

  return mutate(!isProvider && !(isSuperAdmin && impersonating));
}

function engineExecution({ factoryEngine, methods }) {
  console.log('%c executing locally', 'color: lightgreen');
  return factoryEngine.executionQueue(methods) || {};
}

async function localSave(saveLocal) {
  if (saveLocal || env.saveLocal) {
    console.log('%c localSave', 'color: yellow');
    await saveTournamentRecord();
  }
}

async function makeMutation({ methods, completion, factoryEngine, tournamentIds, saveLocal = true }) {
  if (window['dev']?.params) {
    for (const method of methods) {
      if (window['dev'].params[method.method]) {
        method.params = { ...method.params, ...window['dev'].params[method.method] };
      }
    }
  }

  // NOTE: this enables logging of all methods called during executionQueue when there is an internal factory error
  if (window?.['dev']?.getContext().internal) console.log({ methods });

  let factoryResult;
  if (!env.serverFirst) {
    factoryResult = engineExecution({ factoryEngine, methods });
    if (factoryResult.error) return completion(factoryResult);
  }

  if (factoryResult?.success || env.serverFirst) {
    const ackCallback = async (ack) => {
      if (env.serverFirst && ack?.success) {
        factoryResult = engineExecution({ factoryEngine, methods });
        if (factoryResult.error) return completion(factoryResult);
        await localSave(saveLocal);
        return completion(factoryResult);
      }
    };
    console.log('%c invoking remote', 'color: lightblue');
    emitTmx({ data: { type: 'executionQueue', payload: { methods, tournamentIds } }, ackCallback });
    if (!env.serverFirst) await localSave(saveLocal);
  }

  return !env.serverFirst ? completion(factoryResult) : completion({ success: true });
}
