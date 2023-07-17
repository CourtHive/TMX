import { deleteFlights } from 'components/modals/deleteFlights';
import { renderForm } from 'components/renderers/renderForm';
import { context } from 'services/context';

import { NONE } from 'constants/tmxConstants';

export function selectAndDeleteEventFlights({ eventData }) {
  const options = eventData.drawsData.map(({ drawId, drawName }) => ({
    label: drawName,
    checkbox: true,
    field: drawId,
    id: drawId
  }));

  let inputs;
  const onClick = () => {
    const drawIds = eventData.drawsData.filter(({ drawId }) => inputs[drawId]?.checked).map(({ drawId }) => drawId);
    setTimeout(() => deleteFlights({ eventData, drawIds }), 200);
  };

  const checkChecked = () => {
    const checkedFlights = eventData.drawsData.filter(({ drawId }) => inputs[drawId]?.checked).length;
    const deleteButton = document.getElementById('deleteSelected');
    if (deleteButton) deleteButton.disabled = !checkedFlights;
  };

  const relationships = eventData.drawsData.map(({ drawId }) => ({
    onChange: checkChecked,
    control: drawId
  }));
  const content = (elem) => (inputs = renderForm(elem, options, relationships));

  context.modal.open({
    title: `Delete flights`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Delete', id: 'deleteSelected', intent: 'is-danger', disabled: true, close: true, onClick }
    ]
  });
}
