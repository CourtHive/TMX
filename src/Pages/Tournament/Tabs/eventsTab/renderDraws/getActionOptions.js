import { tournamentEngine, eventConstants, utilities } from 'tods-competition-factory';
import { updateTieFormat } from 'components/overlays/editTieFormat.js/updateTieFormat';
import { renderScorecard } from 'components/overlays/scorecard/scorecard';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { deleteFlights } from 'components/modals/deleteFlights';
import { removeAllChildNodes } from 'services/dom/transformers';
import { editMatchUpFormat } from './editMatchUpFormat';
import { removeStructure } from './removeStructure';

import { RESET_SCORECARD } from 'constants/mutationConstants';
import { DRAWS_VIEW } from 'constants/tmxConstants';
import { tmxToast } from 'services/notifications/tmxToast';

const { TEAM } = eventConstants;

export function getActionOptions({ eventData, drawData, drawId, structureId, structureName, dualMatchUp }) {
  const structure = drawData.structures?.find((structure) => structure.structureId === structureId);
  const eventId = eventData.eventInfo.eventId;

  const options = [
    {
      hide: eventData.eventInfo.eventType !== TEAM,
      onClick: () => updateTieFormat({ structureId, eventId, drawId }),
      label: 'Edit scorecard',
      close: true
    },
    {
      hide: eventData.eventInfo.eventType === TEAM,
      onClick: () => editMatchUpFormat({ structureId, eventId, drawId }),
      label: `Edit ${structureName} scoring`,
      close: true
    },
    {
      hide: structure?.stage === 'MAIN' && structure.stageSequence === 1,
      onClick: () => removeStructure({ drawId, eventId, structureId }),
      label: 'Remove structure',
      close: true
    },
    {
      onClick: () => deleteFlights({ eventData, drawIds: [drawId] }),
      label: 'Delete draw'
    }
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
        drawId
      }).matchUp;
      const resultsPresent = currentMatchUp.tieMatchUps?.some(utilities.scoreHasValue);
      if (resultsPresent) {
        tmxToast({
          message: 'Cannot remove when scores are present',
          intent: 'is-warning',
          pauseOnHover: true
        });
      } else {
        const methods = [
          {
            params: { drawId, matchUpId, inheritance: false },
            method: 'resetMatchUpLineUps'
          }
        ];
        mutationRequest({ methods, callback: postMutation });
      }
    };
    const removeParticipantsButton = {
      label: 'Remove players',
      onClick: removePlayers,
      close: true
    };
    options.push(removeParticipantsButton);

    const clearResults = () => {
      const methods = [
        {
          params: { drawId, matchUpId },
          method: RESET_SCORECARD
        }
      ];
      mutationRequest({ methods, callback: postMutation });
    };
    const clearResultsButton = {
      label: 'Clear results',
      onClick: clearResults,
      close: true
    };
    options.push(clearResultsButton);
  }

  return options;
}
