import { saveTournamentRecord } from 'services/storage/save';
import * as factory from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';

import { TOURNAMENT_ENGINE } from 'constants/tmxConstants';

export function mutationRequest({ methods, engine = TOURNAMENT_ENGINE, callback }) {
  const completion = (result) => isFunction(callback) && callback(result);

  if (!Array.isArray(methods)) return completion();
  const factoryEngine = factory[engine];

  if (!factoryEngine) {
    return completion();
  } else {
    if (window['dev']?.params) {
      for (const method of methods) {
        if (window['dev'].params[method]) {
          method.params = { ...method.params, ...window['dev'].params[method] };
        }
      }
    }
    const result = factoryEngine.executionQueue(methods) || {};
    if (result.error) {
      return completion(result);
    }

    if (result?.success) {
      saveTournamentRecord();
    }

    return completion(result);
  }
}
