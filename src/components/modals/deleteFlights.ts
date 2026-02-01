/**
 * Delete flight and draw modal with audit reason.
 * Validates word count and permanently deletes flights with force option and mutation.
 */
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { validators, renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { isDev } from 'functions/isDev';

import { DELETE_FLIGHT_AND_DRAW } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

type DeleteFlightsParams = {
  eventData?: any;
  eventId?: string;
  drawIds: string[];
  callback?: (result: any) => void;
};

export function deleteFlights(params: DeleteFlightsParams): void {
  const { eventData, drawIds, callback } = params;
  const eventId = params.eventId ?? eventData.eventInfo.eventId;

  // Skip reason modal if env.skipReason is true
  if (isDev()) {
    const auditData = { auditReason: 'Reason skipped' };
    const methods = drawIds.map((drawId) => ({
      params: { eventId, drawId, auditData, force: true },
      method: DELETE_FLIGHT_AND_DRAW,
    }));
    const postMutation = (result: any) => (callback ? callback(result) : navigateToEvent({ eventId }));
    mutationRequest({ methods, callback: postMutation });
    return;
  }

  const drawName =
    drawIds.length === 1 && eventData?.drawsData?.find((data: any) => drawIds.includes(data.drawId)).drawName;
  const modalTitle = drawName ? `Delete ${drawName}` : 'Delete flights';

  let inputs: any;
  const deleteAction = () => {
    const auditData = { auditReason: inputs['drawDeletionReason'].value };
    const methods = drawIds.map((drawId) => ({
      params: { eventId, drawId, auditData, force: true },
      method: DELETE_FLIGHT_AND_DRAW,
    }));
    const postMutation = (result: any) => (callback ? callback(result) : navigateToEvent({ eventId }));
    mutationRequest({ methods, callback: postMutation });
  };
  const items = [
    {
      text: `Please provide a reason for draw deletion.`,
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
