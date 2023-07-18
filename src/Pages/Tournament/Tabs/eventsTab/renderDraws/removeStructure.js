import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';

import { REMOVE_STRUCTURE } from 'constants/mutationConstants';

export function removeStructure({ drawId, eventId, structureId }) {
  const methods = [
    {
      params: { drawId, structureId },
      method: REMOVE_STRUCTURE
    }
  ];

  const postMutation = (result) => {
    if (result.success) {
      navigateToEvent({ eventId, drawId, renderDraw: true });
    } else {
      tmxToast({ message: result.error?.message || 'Error', intent: 'is-danger ' });
    }
  };

  mutationRequest({ methods, callback: postMutation });
}
