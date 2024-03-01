import { updateTieFormat } from 'components/overlays/editTieFormat.js/updateTieFormat';
import { tournamentEngine, eventConstants } from 'tods-competition-factory';
import { renderScorecard } from 'components/overlays/scorecard/scorecard';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { removeAllChildNodes } from 'services/dom/transformers';
import { deleteFlights } from 'components/modals/deleteFlights';
import { resetDraws } from 'components/modals/resetDraws';
import { tmxToast } from 'services/notifications/tmxToast';
import { editMatchUpFormat } from './editMatchUpFormat';
import { removeStructure } from './removeStructure';

import { DRAWS_VIEW, QUALIFYING } from 'constants/tmxConstants';
import { RESET_SCORECARD } from 'constants/mutationConstants';

const { TEAM } = eventConstants;

export function getActionOptions({ eventData, drawData, drawId, structureId, structureName, dualMatchUp }) {
  const hasQualifying = drawData.structures?.find((structure) => structure.stage === QUALIFYING);
  const structure = drawData.structures?.find((structure) => structure.structureId === structureId);
  const eventId = eventData.eventInfo.eventId;

  const options = [
    {
      hide: eventData.eventInfo.eventType !== TEAM,
      onClick: () => updateTieFormat({ matchUpId: dualMatchUp.matchUpId, structureId, eventId, drawId }),
      label: 'Edit scorecard',
      close: true,
    },
    {
      hide: eventData.eventInfo.eventType === TEAM,
      onClick: () => editMatchUpFormat({ structureId, eventId, drawId }),
      label: `Edit ${structureName} scoring`,
      close: true,
    },
    {
      hide: structure?.stage === 'MAIN' && structure.stageSequence === 1 && !hasQualifying,
      onClick: () => removeStructure({ drawId, eventId, structureId }),
      label: 'Remove structure',
      close: true,
    },
    {
      onClick: () => deleteFlights({ eventData, drawIds: [drawId] }),
      label: 'Delete draw',
    },
    {
      onClick: () => resetDraws({ eventData, drawIds: [drawId] }),
      label: 'Reset draw',
    },
  ];

  if (dualMatchUp) {
    const matchUpId = dualMatchUp.matchUpId;
    options.push({ divider: true });

    const postMutation = (result) => {
      if (result.success) {
        const matchUp = tournamentEngine.findMatchUp({ drawId, matchUpId })?.matchUp;
        const scorecard = renderScorecard({ matchUp });
        const drawsView = document.getElementById(DRAWS_VIEW);
        removeAllChildNodes(drawsView);
        drawsView.appendChild(scorecard);
      }
    };
    const removePlayers = () => {
      const currentMatchUp = tournamentEngine.findMatchUp({
        matchUpId,
        drawId,
      }).matchUp;
      const resultsPresent = currentMatchUp.tieMatchUps?.some(tournamentEngine.checkScoreHasValue);
      if (resultsPresent) {
        tmxToast({
          message: 'Cannot remove when scores are present',
          intent: 'is-warning',
          pauseOnHover: true,
        });
      } else {
        const methods = [
          {
            params: { drawId, matchUpId, inheritance: false },
            method: 'resetMatchUpLineUps',
          },
        ];
        mutationRequest({ methods, callback: postMutation });
      }
    };
    const removeParticipantsButton = {
      label: 'Remove players',
      onClick: removePlayers,
      close: true,
    };
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
      label: 'Clear results',
      onClick: clearResults,
      close: true,
    };
    options.push(clearResultsButton);
  }

  return options;
}
