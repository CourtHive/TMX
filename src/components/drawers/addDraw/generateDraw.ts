/**
 * Generate draw definition with tournament engine.
 * Applies active scale configuration and adds draw to event via mutation.
 */
import { getAutoCourtImageMethod } from 'services/courtSvg/autoCourtImage';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { preferencesConfig } from 'config/preferencesConfig';
import { tournamentEngine } from 'services/factory/engine';
import { scoreGovernor } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
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
  const { isDraft, confirmedReplace, ...restOptions } = drawOptions;

  // Guard: regenerating over an existing draw that already has completed matches would discard
  // them. Confirm first, then re-issue with force. The factory also refuses SCORES_PRESENT without
  // force, so this is the friendly front-half of that backstop (and a recoverable snapshot is kept).
  if (restOptions.drawId && !confirmedReplace && drawHasScores(restOptions.drawId)) {
    confirmModal({
      title: 'Regenerate draw?',
      query: 'This draw has completed matches. Regenerating will discard them. A recoverable snapshot is saved. Continue?',
      okIntent: 'is-warning',
      okAction: () => generateDraw({ eventId, drawOptions: { ...drawOptions, confirmedReplace: true }, callback }),
    });
    return;
  }

  const scale = scalesMap[preferencesConfig.get().activeScale?.toLowerCase()];
  const adHocConfig = {
    scaleAccessor: scale?.accessor,
    scaleName: scale?.scaleName,
  };
  const { scaleName: swissScaleName, ...genOptions } = restOptions;
  const result = tournamentEngine.generateDrawDefinition({ ...genOptions, ...adHocConfig, ignoreStageSpace: true });

  if (result.success && result.drawDefinition) {
    const drawDefinition = result.drawDefinition;
    const drawId = drawDefinition.drawId;
    const methods: any[] = [
      { method: ADD_DRAW_DEFINITION, params: { eventId, drawDefinition, allowReplacement: true, force: !!confirmedReplace } },
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

function drawHasScores(drawId: string): boolean {
  const { matchUps = [] } = tournamentEngine.allDrawMatchUps({ drawId }) || {};
  return matchUps.some((m: any) => m?.winningSide || scoreGovernor.checkScoreHasValue(m));
}
