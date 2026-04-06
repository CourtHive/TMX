/**
 * Generate draw definition with tournament engine.
 * Applies active scale configuration and adds draw to event via mutation.
 */
import { getAutoCourtImageMethod } from 'services/courtSvg/autoCourtImage';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { preferencesConfig } from 'config/preferencesConfig';
import { scalesMap } from 'config/scalesConfig';
import { isFunction } from 'functions/typeOf';

// Constants
import { ADD_DRAW_DEFINITION, ADD_DRAW_DEFINITION_EXTENSION, INITIALIZE_DRAFT } from 'constants/mutationConstants';

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
  const scale = scalesMap[preferencesConfig.get().activeScale?.toLowerCase()];
  const adHocConfig = {
    scaleAccessor: scale?.accessor,
    scaleName: scale?.scaleName,
  };
  const { scaleName: swissScaleName, ...genOptions } = restOptions;
  const result = tournamentEngine.generateDrawDefinition({ ...genOptions, ...adHocConfig, ignoreStageSpace: true });

  if (result.success) {
    const drawDefinition = result.drawDefinition;
    const drawId = drawDefinition.drawId;
    const methods: any[] = [
      { method: ADD_DRAW_DEFINITION, params: { eventId, drawDefinition, allowReplacement: true } },
    ];

    if (swissScaleName) {
      methods.push({
        method: ADD_DRAW_DEFINITION_EXTENSION,
        params: { drawId, extension: { name: 'swissScaleName', value: swissScaleName } },
      });
    }

    const courtMethod = getAutoCourtImageMethod(eventId, genOptions?.matchUpFormat || drawDefinition?.matchUpFormat);
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
