import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine, tools } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { editTieFormat } from './editTieFormat';
import { isFunction } from 'functions/typeOf';

export function updateTieFormat({ matchUpId, structureId, eventId, drawId, callback }) {
  const { tieFormat } = tournamentEngine.getTieFormat({
    structureId,
    matchUpId,
    eventId,
    drawId,
  });

  const updateFormat = (modifiedTieFormat) => {
    if (modifiedTieFormat) {
      modifiedTieFormat.collectionDefinitions?.forEach((def, i) => (def.collectionOrder = i + 1));

      const different = tools.compareTieFormats({
        considerations: { collectionName: true, collectionOrder: true },
        descendant: modifiedTieFormat,
        ancestor: tieFormat,
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
            matchUpId,
            drawId,
          },
        },
      ];

      const postMutation = (result) => {
        if (result.success) {
          tmxToast({ intent: 'is-success', message: 'Scorecard updated' });
          isFunction(callback) && callback();
        } else {
          tmxToast({ intent: 'is-danger', message: result.error?.message || 'Error' });
        }
      };
      mutationRequest({ methods, callback: postMutation });
    }
  };

  editTieFormat({ title: 'Edit scorecard', tieFormat, onClose: updateFormat });
}
