import { participantConstants, participantRoles } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
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
  refresh
}) {
  const PARTICIPANT_NAME = 'participantName';
  const values = { [PARTICIPANT_NAME]: participant?.[PARTICIPANT_NAME] };
  let inputs;

  const valueChange = (/*e, item*/) => {
    // console.log(item.field, e.target.value);
  };

  const content = (elem) => {
    inputs = renderForm(elem, [
      {
        error: 'Please enter a name of at least 3 characters',
        placeholder: 'Participant name',
        value: values[PARTICIPANT_NAME] || '',
        validator: nameValidator(3),
        field: PARTICIPANT_NAME,
        onChange: valueChange,
        label: 'Name'
      }
      // school, club, team => autocomplete from GROUP participants in tournament
      // city, state, phone, email
    ]);
  };

  const footer = (elem, close) =>
    renderButtons(
      elem,
      [
        { label: 'Cancel', close: true },
        { label: 'Save', onClick: saveParticipant, close: true, intent: 'is-info' }
      ],
      close
    );

  context.drawer.open({
    title: `<b style='larger'>${title}</b>`,
    callback: () => console.log('drawer callback'),
    width: '300px',
    side: RIGHT,
    content,
    footer
  });

  function saveParticipant() {
    if (!participant?.participantId) {
      addParticipant();
    } else {
      console.log('update existing');
    }
  }

  function addParticipant() {
    const participantRole = participantType === TEAM ? COMPETITOR : OTHER;
    const newParticipant = {
      individualParticipantIds: individualParticipantIds || participant?.individualParticipantIds || [],
      participantName: inputs[PARTICIPANT_NAME]?.value,
      participantRole,
      participantType
    };

    const postMutation = (result) => {
      if (result.success) {
        // QUESTION: add participant to table, or just refresh?
        isFunction(refresh) && refresh();
      } else {
        console.log(result);
      }
    };
    const methods = [
      {
        params: { participants: [newParticipant] },
        method: ADD_PARTICIPANTS
      }
    ];
    mutationRequest({ methods, callback: postMutation });
  }

  return { ...SUCCESS };
}
