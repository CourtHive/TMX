/**
 * Generate draw definition with tournament engine.
 * Applies active scale configuration and adds draw to event via mutation.
 */
import { getAutoCourtImageMethod } from 'services/courtSvg/autoCourtImage';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { env } from 'settings/env';

import { ADD_DRAW_DEFINITION, INITIALIZE_DRAFT } from 'constants/mutationConstants';

export function generateDraw({
  eventId,
  drawOptions,
  callback,
}: {
  eventId: string;
  drawOptions: any;
  callback?: (result: any) => void;
}): void {
  const { isDraft, ...restOptions } = drawOptions;
  const scale = env.scales[env.activeScale?.toLowerCase()];
  const adHocConfig = {
    scaleAccessor: scale?.accessor,
    scaleName: scale?.scaleName,
  };
  const result = tournamentEngine.generateDrawDefinition({ ...restOptions, ...adHocConfig, ignoreStageSpace: true });

  if (result.success) {
    const drawDefinition = result.drawDefinition;
    const drawId = drawDefinition.drawId;
    const methods: any[] = [{ method: ADD_DRAW_DEFINITION, params: { eventId, drawDefinition, allowReplacement: true } }];

    const courtMethod = getAutoCourtImageMethod(eventId, restOptions?.matchUpFormat || drawDefinition?.matchUpFormat);
    if (courtMethod) methods.push(courtMethod);

    if (isDraft) {
      methods.push({ method: INITIALIZE_DRAFT, params: { drawId, eventId } });
    }

    const postMutation = (result: any) => isFunction(callback) && callback({ drawDefinition, ...result });
    mutationRequest({ methods, callback: postMutation });
  } else if (result.error) {
    tmxToast({
      message: result.error?.message || 'Error',
      intent: 'is-warning',
      pauseOnHover: true,
    });
  }
}
