import { updateTieFormat } from 'components/overlays/editTieFormat.js/updateTieFormat';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { eventConstants } from 'tods-competition-factory';
import { editMatchUpFormat } from './editMatchUpFormat';
import { context } from 'services/context';

import { DELETE_FLIGHT_AND_DRAW } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';
import { wordValidator } from 'components/validators/wordValidator';

const { TEAM } = eventConstants;

export function getActionOptions({ eventData, drawId, structureId, structureName }) {
  const eventId = eventData.eventInfo.eventId;

  const deleteDraw = () => {
    const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);

    let inputs;
    const deleteAction = () => {
      const auditData = { auditReason: inputs['drawDeletionReason'].value };
      const methods = [{ method: DELETE_FLIGHT_AND_DRAW, params: { eventId, drawId, auditData } }];
      const postMutation = (result) => result.success && navigateToEvent({ eventId });
      mutationRequest({ methods, callback: postMutation });
    };
    const items = [
      {
        text: `Please provide a reason for draw deletion.`
      },
      {
        placeholder: 'Explanation',
        field: 'drawDeletionReason',
        validator: wordValidator(5),
        error: 'Five word minimum',
        focus: true
      },
      {
        text: `This action cannot be undone!`
      }
    ];
    const enableSubmit = ({ inputs }) => {
      const value = inputs['drawDeletionReason'].value;
      const isValid = wordValidator(5)(value);
      const deleteButton = document.getElementById('deleteDraw');
      if (deleteButton) deleteButton.disabled = !isValid;
    };
    const relationships = [
      {
        control: 'drawDeletionReason',
        onInput: enableSubmit
      }
    ];
    const content = (elem) => (inputs = renderForm(elem, items, relationships));

    context.modal.open({
      title: `Delete ${drawData.drawName}`,
      content,
      buttons: [
        { label: 'Cancel', intent: NONE, close: true },
        { label: 'Delete', id: 'deleteDraw', disabled: true, intent: 'is-danger', close: true, onClick: deleteAction }
      ]
    });
  };

  return [
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
      onClick: () => navigateToEvent({ eventId, drawId }),
      label: 'View entries'
    },
    {
      onClick: deleteDraw,
      label: 'Delete draw'
    }
  ];
}
