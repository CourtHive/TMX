import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';

import { REMOVE_STRUCTURE } from 'constants/mutationConstants';

export function removeStructure({ drawId, eventId, structureId }) {
  const methods = [
    {
      params: { drawId, structureId, force: true },
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

  const removeIt = () => mutationRequest({ methods, callback: postMutation });

  const content = `<div style='font-size: 2em'>Structure will be removed!</div>`;
  const buttons = [
    {
      intent: 'is-danger',
      onClick: removeIt,
      label: 'Remove',
      close: true
    },
    { label: 'Cancel' }
  ];
  openModal({ title: 'Remove structure', buttons, content });
}
