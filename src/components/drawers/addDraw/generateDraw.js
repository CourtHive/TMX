import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';

import { ADD_DRAW_DEFINITION } from 'constants/mutationConstants';

export function generateDraw({ eventId, drawOptions, callback }) {
  const result = tournamentEngine.generateDrawDefinition({ ...drawOptions, ignoreStageSpace: true });

  if (result.success) {
    const drawDefinition = result.drawDefinition;
    const methods = [{ method: ADD_DRAW_DEFINITION, params: { eventId, drawDefinition } }];
    const postMutation = (result) => isFunction(callback) && callback({ drawDefinition, ...result });
    mutationRequest({ methods, callback: postMutation });
  } else if (result.error) {
    tmxToast({
      message: result.error?.message,
      intent: 'is-warning',
      pauseOnHover: true
    });
  }
}
