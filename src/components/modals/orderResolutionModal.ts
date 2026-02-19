/**
 * Order Resolution modal for assigning subOrder to tied participants.
 * Ensures unique order assignments with validation and relationship management.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

// constants
import { SET_SUB_ORDER } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

type TiedAssignment = {
  participantId: string;
  drawPosition: number;
};

type OrderResolutionParams = {
  tiedAssignments: TiedAssignment[];
  participants: any[];
  structureId: string;
  drawId: string;
  callback?: (result: any) => void;
};

export function orderResolutionModal({
  tiedAssignments,
  participants,
  structureId,
  drawId,
  callback,
}: OrderResolutionParams): void {
  if (!participants?.length || !tiedAssignments?.length) {
    return;
  }

  const participantCount = participants.length;
  const orderOptions = Array.from({ length: participantCount }, (_, i) => ({
    label: (i + 1).toString(),
    value: i + 1,
  }));

  let inputs: any;

  const getParticipantName = (participant: any) => {
    const individualParticipantIds = participant.individualParticipantIds || [];
    if (individualParticipantIds.length > 0 && participant.individualParticipants) {
      return participant.individualParticipants.map((p: any) => p.participantName || 'Unknown').join(' / ');
    }
    return participant.participantName || 'Unknown Participant';
  };

  const checkValid = () => {
    const selectedValues = participants
      .map((participant) => inputs[participant.participantId]?.value)
      .filter((value) => value !== undefined && value !== '');

    const uniqueValues = new Set(selectedValues);
    const allAssigned = selectedValues.length === participantCount;
    const noDuplicates = uniqueValues.size === selectedValues.length;

    const submitButton = document.getElementById('submitOrder');
    if (submitButton) {
      (submitButton as HTMLButtonElement).disabled = !(allAssigned && noDuplicates);
    }
  };

  const handleOrderChange = (changedParticipantId: string) => {
    const changedValue = inputs[changedParticipantId]?.value;

    if (changedValue) {
      participants.forEach((participant) => {
        if (participant.participantId !== changedParticipantId) {
          const currentValue = inputs[participant.participantId]?.value;
          if (currentValue === changedValue) {
            const remainingValues = orderOptions
              .map((opt) => opt.value)
              .filter((value) =>
                participants.every(
                  (p) => p.participantId === participant.participantId || inputs[p.participantId]?.value !== value,
                ),
              );

            if (remainingValues.length === 1) {
              const select = document.getElementById(participant.participantId) as HTMLSelectElement;
              if (select) {
                select.value = remainingValues[0].toString();
                inputs[participant.participantId].value = remainingValues[0];
              }
            } else {
              const select = document.getElementById(participant.participantId) as HTMLSelectElement;
              if (select) {
                select.value = '';
                inputs[participant.participantId].value = undefined;
              }
            }
          }
        }
      });
    }

    checkValid();
  };

  const relationships = participants.map((participant) => ({
    control: participant.participantId,
    onChange: () => handleOrderChange(participant.participantId),
  }));

  const options = participants.map((participant) => ({
    text: getParticipantName(participant),
    style: 'font-size: 0.9em;',
    fieldPair: {
      options: [{ label: '', value: '' }, ...orderOptions],
      field: participant.participantId,
      id: participant.participantId,
      style: 'font-size: 0.9em;',
      width: '80px',
      value: '',
    },
  }));

  const onClick = () => {
    const selectedOrders = tiedAssignments.map((assignment) => ({
      groupOrder: inputs[assignment.participantId]?.value,
      participantId: assignment.participantId,
      drawPosition: assignment.drawPosition,
    }));
    const methods = tiedAssignments
      .map((assignment) => {
        const subOrder = inputs[assignment.participantId]?.value;
        if (subOrder) {
          return {
            method: SET_SUB_ORDER,
            params: {
              drawPosition: assignment.drawPosition,
              structureId,
              subOrder,
              drawId,
            },
          };
        }
        return null;
      })
      .filter(Boolean);

    const postMutation = (result: any) => {
      if (result.success) {
        tmxToast({ message: t('modals.orderResolution.updated'), intent: 'is-success' });
        if (isFunction(callback)) {
          callback(selectedOrders);
        }
      } else {
        tmxToast({ message: t('modals.orderResolution.updateFailed'), intent: 'is-error' });
      }
    };

    mutationRequest({ methods, callback: postMutation });
  };

  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options, relationships));

  openModal({
    title: t('modals.orderResolution.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('common.submit'), id: 'submitOrder', disabled: true, intent: 'is-info', close: true, onClick },
    ],
  });
}
