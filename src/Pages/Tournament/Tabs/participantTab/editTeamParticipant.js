import { participantConstants, participantRoles } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_PARTICIPANTS } from 'constants/mutationConstants';
import { RIGHT, SUCCESS } from 'constants/tmxConstants';

const { COMPETITOR } = participantRoles;
const { TEAM } = participantConstants;

export function editTeamParticipant({ title = 'Edit team', individualParticipantIds, participant, refresh }) {
  const values = {
    teamName: participant?.participantName
  };
  let inputs;

  const valueChange = (/*e, item*/) => {
    // console.log(item.field, e.target.value);
  };

  const content = (elem) => {
    inputs = renderForm(elem, [
      {
        placeholder: 'Participant name',
        value: values.teamName || '',
        label: 'Team name',
        field: 'teamName',
        error: 'Please enter a name of at least 3 characters',
        validator: nameValidator(3),
        onChange: valueChange
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
    const newParticipant = {
      individualParticipantIds: individualParticipantIds || participant?.individualParticipantIds || [],
      participantName: inputs.teamName?.value,
      participantRole: COMPETITOR,
      participantType: TEAM
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
        method: ADD_PARTICIPANTS,
        params: { participants: [newParticipant] }
      }
    ];
    mutationRequest({ methods, callback: postMutation });
  }

  return { ...SUCCESS };
}
