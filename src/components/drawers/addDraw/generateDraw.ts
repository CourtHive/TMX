/**
 * Generate draw definition with tournament engine.
 * Applies active scale configuration and adds draw to event via mutation.
 */
import { getAutoCourtImageMethod } from 'services/courtSvg/autoCourtImage';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getEntriesNotPlacedNotices } from './entriesNotPlaced';
import { preferencesConfig } from 'config/preferencesConfig';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { scoreGovernor } from 'tods-competition-factory';
import { scalesMap } from 'config/scalesConfig';
import { isFunction } from 'functions/typeOf';

// Constants
import { ADD_DRAW_DEFINITION, ADD_DRAW_DEFINITION_EXTENSION, INITIALIZE_DRAFT } from 'constants/mutationConstants';
import { t } from 'i18n';

const IS_WARNING = 'is-warning';

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
      title: t('addDrawForm.regenerate'),
      query:
        'This draw has completed matches. Regenerating will discard them. A recoverable snapshot is saved. Continue?',
      okIntent: IS_WARNING,
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
      {
        method: ADD_DRAW_DEFINITION,
        params: { eventId, drawDefinition, allowReplacement: true, force: !!confirmedReplace },
      },
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

    // generation leaves out the entries a full stage has no place for; the director is told, nothing is blocked
    const warnings = result.warnings;
    const postMutation = (result: any) => {
      if (isFunction(callback)) callback({ drawDefinition, ...result });
      // after the callback, so a toast it raises does not replace the notice
      if (result?.success) notifyEntriesNotPlaced(warnings);
    };
    mutationRequest({ methods, callback: postMutation });
  } else if (result.error) {
    tmxToast({
      message: result.error?.message || 'Error',
      intent: IS_WARNING,
      pauseOnHover: true,
    });
  }
}

function notifyEntriesNotPlaced(warnings: any[] | undefined): void {
  if (!warnings?.length) return;
  const participantIds = warnings.flatMap((warning: any) => warning?.participantIds ?? []);
  const { participants = [] } = tournamentEngine.getParticipants({ participantFilters: { participantIds } }) || {};
  for (const notice of getEntriesNotPlacedNotices({ warnings, participants })) {
    const key = notice.isQualifying ? 'drawers.addDraw.qualifyingEntriesNotPlaced' : 'drawers.addDraw.entriesNotPlaced';
    tmxToast({
      message: t(key, { count: notice.count, drawSize: notice.drawSize, names: notice.names.join(', ') }),
      intent: IS_WARNING,
      pauseOnHover: true,
      duration: 12000,
    });
  }
}

function drawHasScores(drawId: string): boolean {
  const { matchUps = [] } = tournamentEngine.allDrawMatchUps({ drawId }) || {};
  return matchUps.some((m: any) => m?.winningSide || scoreGovernor.checkScoreHasValue(m));
}
