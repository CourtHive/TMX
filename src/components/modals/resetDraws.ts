/**
 * Reset draw definitions modal with audit reason.
 * Validates word count and resets draw to initial state with mutation.
 */
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { validators, renderForm, openModal } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';

import { RESET_DRAW_DEFINITION } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function resetDraws({ eventData, drawIds }: { eventData: any; drawIds: string[] }): void {
  const eventId = eventData.eventInfo.eventId;
  const drawName =
    drawIds.length === 1 && eventData?.drawsData?.find((data: any) => drawIds.includes(data.drawId)).drawName;
  const modalTitle = drawName ? `Delete ${drawName}` : 'Delete flights';

  let inputs: any;
  const deleteAction = () => {
    const auditData = { auditReason: inputs['drawDeletionReason'].value };
    const methods = drawIds.map((drawId) => ({
      params: { eventId, drawId, auditData },
      method: RESET_DRAW_DEFINITION,
    }));
    const postMutation = (result: any) => result.success && navigateToEvent({ eventId, drawId: drawIds[0] });
    mutationRequest({ methods, callback: postMutation });
  };
  const items = [
    {
      text: `Please provide a reason for resetting draws.`,
      style: 'height: 2.5em; padding-right: 1em; font-size: 0.9em;',
    },
    {
      placeholder: 'Explanation',
      field: 'drawDeletionReason',
      validator: validators.wordValidator(5),
      error: 'Five word minimum',
      autocomplete: 'on',
      focus: true,
    },
    {
      text: `This action cannot be undone!`,
      style: 'height: 2.5em; padding-right: 1em; font-size: 0.9em;',
    },
  ];
  const enableSubmit = ({ inputs }: any) => {
    const value = inputs['drawDeletionReason'].value;
    const isValid = validators.wordValidator(5)(value);
    const deleteButton = document.getElementById('deleteDraw');
    if (deleteButton) (deleteButton as HTMLButtonElement).disabled = !isValid;
  };
  const relationships = [
    {
      control: 'drawDeletionReason',
      onInput: enableSubmit,
    },
  ];
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, items, relationships));

  openModal({
    title: modalTitle,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Delete', id: 'deleteDraw', disabled: true, intent: 'is-danger', close: true, onClick: deleteAction },
    ],
  });
}
