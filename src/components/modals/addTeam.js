import { participantConstants, participantRoles } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_PARTICIPANTS } from 'constants/mutationConstants';

const { COMPETITOR } = participantRoles;
const { TEAM } = participantConstants;

export function addTeam({ callback } = {}) {
  const createNewTeam = () => {
    const participantName = context.modal.attributes?.content.newName.value;

    const methods = [
      {
        method: ADD_PARTICIPANTS,
        params: {
          participants: [
            {
              participantRole: COMPETITOR,
              participantType: TEAM,
              participantName
            }
          ]
        }
      }
    ];

    const postMutation = (result) => {
      if (result.success) {
        isFunction(callback) && callback();
      } else {
        console.log(result);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const content = (elem) =>
    renderForm(elem, [
      {
        value: '',
        label: 'Team name',
        field: 'newName'
      }
    ]);

  context.modal.open({
    title: 'Add team',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Create new', intent: 'is-primary', close: true, onClick: createNewTeam }
    ]
  });
}
