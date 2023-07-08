import { tournamentEngine, utilities } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { editTieFormat } from './editTieFormat';

export function updateTieFormat({ structureId, eventId, drawId }) {
  const { tieFormat } = tournamentEngine.getTieFormat({
    structureId,
    eventId,
    drawId
  });
  const updateTieFormat = (modifiedTieFormat) => {
    if (modifiedTieFormat) {
      modifiedTieFormat.collectionDefinitions?.forEach((def, i) => (def.collectionOrder = i + 1));

      const different = utilities.compareTieFormats({
        considerations: { collectionName: true, collectionOrder: true },
        descendant: modifiedTieFormat,
        ancestor: tieFormat
      })?.different;

      if (!different) {
        tmxToast({ intent: 'is-info', message: 'No changes' });
        return;
      }

      const methods = [
        {
          method: 'modifyTieFormat',
          params: {
            modifiedTieFormat,
            structureId,
            drawId
          }
        }
      ];

      const postMutation = (result) => {
        if (result.success) {
          tmxToast({ intent: 'is-success', message: 'Scorecard updated' });
        } else {
          tmxToast({ intent: 'is-danger', message: result.error });
        }
      };
      mutationRequest({ methods, callback: postMutation });
    }
  };

  editTieFormat({ title: 'Edit scorecard', tieFormat, onClose: updateTieFormat });
}
