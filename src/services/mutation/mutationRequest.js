import { getLoginState } from 'services/authentication/loginState';
import { saveTournamentRecord } from 'services/storage/save';
import { tmxToast } from 'services/notifications/tmxToast';
import { emitTmx } from 'services/messaging/socketIo';
import * as factory from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { SUPER_ADMIN, TOURNAMENT_ENGINE } from 'constants/tmxConstants';

export function mutationRequest({ methods, engine = TOURNAMENT_ENGINE, callback }) {
  const completion = (result) => isFunction(callback) && callback(result);

  if (!Array.isArray(methods)) return completion();
  const factoryEngine = factory[engine];
  if (!factoryEngine) return completion();

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

  const state = getLoginState();

  if (providerIds.length) {
    // if the tournamentRecord(s) are associated with a providerId, check permissions
    if (!state) return tmxToast({ message: 'Not logged in', intent: 'is-warning' });
    const isProvider = !!state?.providerIds?.includes(providerIds[0]);
    const isSuperAdmin = state?.roles?.includes(SUPER_ADMIN);
    if (!isProvider && !isSuperAdmin) return tmxToast({ message: 'Not authorised', intent: 'is-danger' });
    if (!isProvider && isSuperAdmin) {
      const impersonating = context.provider?.organisationId === providerIds[0];
      if (!impersonating) {
        const impersonateProvider = () => {
          context.provider = { organisationId: providerIds[0] };
          return makeMutation({ methods, factoryEngine, tournamentIds, completion });
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
    }
  }

  return makeMutation({ methods, factoryEngine, tournamentIds, completion });
}

function makeMutation({ methods, completion, factoryEngine, tournamentIds }) {
  if (window['dev']?.params) {
    for (const method of methods) {
      if (window['dev'].params[method.method]) {
        method.params = { ...method.params, ...window['dev'].params[method.method] };
      }
    }
  }

  // NOTE: this enables logging of all methods called during executionQueue when there is an internal factory error
  if (window?.['dev']?.getContext().internal) console.log({ methods });

  const result = factoryEngine.executionQueue(methods) || {};
  if (result.error) return completion(result);

  if (result?.success) {
    emitTmx({ data: { type: 'executionQueue', payload: { methods, tournamentIds } } });
    saveTournamentRecord();
  }

  return completion(result);
}
