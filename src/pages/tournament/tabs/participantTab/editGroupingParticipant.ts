/**
 * Editor for group participants (teams).
 * Allows creating or editing team/group participants.
 */
import { participantConstants, participantRoles } from 'tods-competition-factory';
import { validators, renderButtons, renderForm } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_PARTICIPANTS, MODIFY_PARTICIPANT } from 'constants/mutationConstants';
import { RIGHT, SUCCESS } from 'constants/tmxConstants';

const { COMPETITOR, OTHER } = participantRoles;
const { TEAM } = participantConstants;

export function editGroupingParticipant({
  individualParticipantIds,
  participantType = TEAM,
  title = 'Edit team',
  participant,
  refresh,
  table,
}: {
  individualParticipantIds?: string[];
  participantType?: string;
  title?: string;
  participant?: any;
  refresh?: () => void;
  table?: any;
}): any {
  const PARTICIPANT_NAME = 'participantName';
  const values = {
    [PARTICIPANT_NAME]: participant?.[PARTICIPANT_NAME],
    nickname: participant?.participantOtherName || '',
    useOtherName: participant?.useOtherName ?? false,
  };
  let inputs: any;

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, [
      {
        error: 'Please enter a name of at least 3 characters',
        placeholder: 'Participant name',
        value: values[PARTICIPANT_NAME] || '',
        validator: validators.nameValidator(3),
        field: PARTICIPANT_NAME,
        label: 'Name',
      },
      {
        placeholder: 'Nickname / abbreviation',
        value: values.nickname,
        field: 'nickname',
        label: 'Nickname',
      },
      {
        checked: values.useOtherName,
        id: 'useOtherName',
        field: 'useOtherName',
        label: 'Prefer nickname in draws',
        checkbox: true,
      },
    ]);
  };

  const footer = (elem: HTMLElement, close: () => void) =>
    renderButtons(
      elem,
      [
        { label: 'Cancel', onClick: () => table?.deselectRow(), close: true },
        { label: 'Save', onClick: saveParticipant, close: true, intent: 'is-info' },
      ],
      close,
    );

  context.drawer.open({
    title: `<b style='larger'>${title}</b>`,
    callback: () => {},
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });

  const postMutation = (result: any) => {
    if (result.success) {
      isFunction(refresh) && refresh?.();
    } else {
      console.log({ result });
    }
  };

  function saveParticipant(): void {
    table?.deselectRow();
    if (participant?.participantId) {
      updateParticipant();
    } else {
      addParticipant();
    }
  }

  function updateParticipant(): void {
    const participantName = inputs[PARTICIPANT_NAME]?.value;
    if (!participantName || participantName.length < 3) return;

    const participantOtherName = inputs.nickname?.value || undefined;
    const useOtherName = inputs.useOtherName?.checked ?? false;

    const methods = [
      {
        method: MODIFY_PARTICIPANT,
        params: {
          participant: {
            participantId: participant.participantId,
            participantOtherName,
            participantName,
            useOtherName,
          },
        },
      },
    ];
    mutationRequest({ methods, callback: postMutation });
  }

  function addParticipant(): void {
    const participantRole = participantType === TEAM ? COMPETITOR : OTHER;
    const newParticipant = {
      individualParticipantIds: individualParticipantIds || participant?.individualParticipantIds || [],
      participantName: inputs[PARTICIPANT_NAME]?.value,
      participantRole,
      participantType,
    };

    const methods = [
      {
        params: { participants: [newParticipant] },
        method: ADD_PARTICIPANTS,
      },
    ];
    mutationRequest({ methods, callback: postMutation });
  }

  return { ...SUCCESS };
}
