/**
 * Editor for group participants (teams).
 * Allows creating or editing team/group participants.
 */
import { participantConstants, participantRoles } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'courthive-components';
import { renderForm } from 'courthive-components';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_PARTICIPANTS } from 'constants/mutationConstants';
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
  const values = { [PARTICIPANT_NAME]: participant?.[PARTICIPANT_NAME] };
  let inputs: any;

  const valueChange = () => {
    // Placeholder for future functionality
  };

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, [
      {
        error: 'Please enter a name of at least 3 characters',
        placeholder: 'Participant name',
        value: values[PARTICIPANT_NAME] || '',
        validator: nameValidator(3),
        field: PARTICIPANT_NAME,
        onChange: valueChange,
        label: 'Name',
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

  function saveParticipant(): void {
    table?.deselectRow();
    if (!participant?.participantId) {
      addParticipant();
    } else {
      console.log('update existing');
    }
  }

  function addParticipant(): void {
    const participantRole = participantType === TEAM ? COMPETITOR : OTHER;
    const newParticipant = {
      individualParticipantIds: individualParticipantIds || participant?.individualParticipantIds || [],
      participantName: inputs[PARTICIPANT_NAME]?.value,
      participantRole,
      participantType,
    };

    const postMutation = (result: any) => {
      if (result.success) {
        isFunction(refresh) && refresh && refresh();
      } else {
        console.log({ result });
      }
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
