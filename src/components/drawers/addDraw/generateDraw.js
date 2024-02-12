import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';

import { ADD_DRAW_DEFINITION } from 'constants/mutationConstants';

export function generateDraw({ eventId, drawOptions, callback }) {
  const adHocConfig = {
    scaleAccessor: 'wtnRating',
    scaleName: 'WTN',
  };
  const result = tournamentEngine.generateDrawDefinition({ ...drawOptions, ...adHocConfig, ignoreStageSpace: true });

  if (result.success) {
    const drawDefinition = result.drawDefinition;
    const methods = [{ method: ADD_DRAW_DEFINITION, params: { eventId, drawDefinition, allowReplacement: true } }];
    const postMutation = (result) => isFunction(callback) && callback({ drawDefinition, ...result });
    mutationRequest({ methods, callback: postMutation });
  } else if (result.error) {
    tmxToast({
      message: result.error?.message || 'Error',
      intent: 'is-warning',
      pauseOnHover: true,
    });
  }
}
