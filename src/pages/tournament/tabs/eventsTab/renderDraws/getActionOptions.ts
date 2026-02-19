/**
 * Action options for draw structures.
 * Provides menu options for editing, removing, and resetting draw structures.
 */
import { tournamentEngine, eventConstants, policyConstants, drawDefinitionConstants } from 'tods-competition-factory';
import { t } from 'i18n';
import { updateTieFormat } from 'components/overlays/editTieFormat.js/updateTieFormat';
import { enterParticipantAssignmentMode } from './participantAssignmentMode';
import { renderScorecard } from 'components/overlays/scorecard/scorecard';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { removeAllChildNodes } from 'services/dom/transformers';
import { deleteFlights } from 'components/modals/deleteFlights';
import { resetDraws } from 'components/modals/resetDraws';
import { tmxToast } from 'services/notifications/tmxToast';
import { editMatchUpFormat } from './editMatchUpFormat';
import { removeStructure } from './removeStructure';
import { printDraw } from 'components/modals/printDraw';
import { env } from 'settings/env';

// constants
import { RESET_MATCHUP_LINEUPS, RESET_SCORECARD } from 'constants/mutationConstants';
import { DRAWS_VIEW, QUALIFYING } from 'constants/tmxConstants';

const { POLICY_TYPE_SCORING } = policyConstants;
const { MAIN } = drawDefinitionConstants;
const { TEAM } = eventConstants;

interface ActionOptionsParams {
  structureName: string;
  dualMatchUp?: any;
  structureId: string;
  eventData: any;
  drawData: any;
  drawId: string;
}

export function getActionOptions({
  structureName,
  dualMatchUp,
  structureId,
  eventData,
  drawData,
  drawId,
}: ActionOptionsParams): any[] {
  const hasQualifying = drawData.structures?.find((structure: any) => structure.stage === QUALIFYING);
  const structure = drawData.structures?.find((structure: any) => structure.structureId === structureId);
  const eventId = eventData.eventInfo.eventId;

  // Get scoring policy to check if participant assignment should be blocked
  const scoringPolicy = tournamentEngine.findPolicy({ policyType: POLICY_TYPE_SCORING, eventId });
  const requireParticipants = scoringPolicy?.requireParticipantsForScoring;

  // Check if draw has any scores
  const hasScores = structure?.roundMatchUps
    ? Object.values(structure.roundMatchUps)
        .flat()
        .some((matchUp: any) => tournamentEngine.checkScoreHasValue(matchUp))
    : false;

  // Only block assignment if scoring policy requires participants AND scores exist
  const blockAssignment = requireParticipants && hasScores;

  // IMPORTANT: Only allow participant assignment for MAIN stage with stageSequence 1
  // to avoid propagation issues with qualifying or playoff structures
  const isMainStage = structure?.stage === MAIN && structure?.stageSequence === 1;

  const scorecardUpdated = () => {
    const matchUpId = dualMatchUp.matchUpId;
    const matchUp = tournamentEngine.findMatchUp({ drawId, matchUpId })?.matchUp;
    const scorecard = renderScorecard({ matchUp });
    const drawsView = document.getElementById(DRAWS_VIEW)!;
    removeAllChildNodes(drawsView);
    drawsView.appendChild(scorecard);
  };

  const options = [
    {
      // Only show for MAIN stage with stageSequence 1, and when not blocked by scores or TEAM event
      hide: !isMainStage || blockAssignment || eventData.eventInfo.eventType === TEAM,
      onClick: () => enterParticipantAssignmentMode({ drawId, eventId, structureId }),
      label: t('pages.events.actionOptions.assignParticipants'),
      close: true,
    },
    {
      hide: eventData.eventInfo.eventType !== TEAM,
      onClick: () =>
        updateTieFormat({ matchUpId: dualMatchUp.matchUpId, structureId, eventId, drawId, callback: scorecardUpdated }),
      label: t('pages.events.actionOptions.editScorecard'),
      close: true,
    },
    {
      hide: eventData.eventInfo.eventType === TEAM,
      onClick: () => editMatchUpFormat({ structureId, drawId }),
      label: t('pages.events.actionOptions.editScoring', { name: structureName }),
      close: true,
    },
    {
      hide: structure?.stage === 'MAIN' && structure.stageSequence === 1 && !hasQualifying,
      onClick: () => removeStructure({ drawId, eventId, structureId }),
      label: t('pages.events.actionOptions.removeStructure'),
      close: true,
    },
    {
      hide: !env.pdfPrinting, // Only show if PDF printing beta feature is enabled
      onClick: () => printDraw({ drawId, eventId, structureId }),
      label: t('pages.events.actionOptions.printDraw'),
      close: true,
    },
    {
      onClick: () => deleteFlights({ eventData, drawIds: [drawId] }),
      label: t('pages.events.actionOptions.deleteDraw'),
    },
    {
      onClick: () => resetDraws({ eventData, drawIds: [drawId] }),
      label: t('pages.events.actionOptions.resetDraw'),
    },
  ];

  if (dualMatchUp) {
    const matchUpId = dualMatchUp.matchUpId;
    options.push({ divider: true } as any);

    const postMutation = (result: any) => result.success && scorecardUpdated();
    const removePlayers = () => {
      const currentMatchUp = tournamentEngine.findMatchUp({
        matchUpId,
        drawId,
      }).matchUp;
      const resultsPresent = currentMatchUp.tieMatchUps?.some(tournamentEngine.checkScoreHasValue);
      if (resultsPresent) {
        tmxToast({
          message: t('pages.events.actionOptions.cannotRemoveScores'),
          intent: 'is-warning',
          pauseOnHover: true,
        });
      } else {
        const methods = [
          {
            params: { drawId, matchUpId, inheritance: false },
            method: RESET_MATCHUP_LINEUPS,
          },
        ];
        mutationRequest({ methods, callback: postMutation });
      }
    };
    const removeParticipantsButton = {
      label: t('pages.events.actionOptions.removePlayers'),
      onClick: removePlayers,
      close: true,
    } as any;
    options.push(removeParticipantsButton);

    const clearResults = () => {
      const methods = [
        {
          params: { drawId, matchUpId },
          method: RESET_SCORECARD,
        },
      ];
      mutationRequest({ methods, callback: postMutation });
    };
    const clearResultsButton = {
      label: t('pages.events.actionOptions.clearResults'),
      onClick: clearResults,
      close: true,
    } as any;
    options.push(clearResultsButton);
  }

  return options;
}
