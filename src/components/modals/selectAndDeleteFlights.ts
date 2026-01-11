/**
 * Select and delete event flights modal.
 * Renders checkbox list of flights with enabled/disabled delete button based on selection.
 */
import { deleteFlights } from 'components/modals/deleteFlights';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';

import { NONE } from 'constants/tmxConstants';

export function selectAndDeleteEventFlights({ eventData }: { eventData: any }): void {
  const options = eventData.drawsData.map(({ drawId, drawName }: any) => ({
    label: drawName,
    checkbox: true,
    field: drawId,
    id: drawId
  }));

  let inputs: any;
  const onClick = () => {
    const drawIds = eventData.drawsData.filter(({ drawId }: any) => inputs[drawId]?.checked).map(({ drawId }: any) => drawId);
    setTimeout(() => deleteFlights({ eventData, drawIds }), 200);
  };

  const checkChecked = () => {
    const checkedFlights = eventData.drawsData.filter(({ drawId }: any) => inputs[drawId]?.checked).length;
    const deleteButton = document.getElementById('deleteSelected');
    if (deleteButton) (deleteButton as HTMLButtonElement).disabled = !checkedFlights;
  };

  const relationships = eventData.drawsData.map(({ drawId }: any) => ({
    onChange: checkChecked,
    control: drawId
  }));
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options, relationships));

  openModal({
    title: `Delete flights`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Delete', id: 'deleteSelected', intent: 'is-danger', disabled: true, close: true, onClick }
    ]
  });
}
