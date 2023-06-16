import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';
import { lang } from 'services/translator';

import { ADD_PARTICIPANTS } from 'constants/mutationConstants';

const valueKey = {
  country: { personAttribute: 'nationalityCode' },
  city: { accessor: 'person.addresses.city' }
};

export function createTeamsFromAttribute({ callback } = {}) {
  const options = [
    { label: lang.tr('cnt'), value: 'country' },
    { label: 'City', value: 'city' }
  ];

  const NO_SELECTION = '-';

  const content = (elem) =>
    renderForm(elem, [
      {
        value: '',
        label: 'Attribute',
        field: 'selection',
        options: [{ label: 'Select attribute', value: NO_SELECTION }, ...options]
      }
    ]);

  const createTeam = () => {
    const selection = context.modal.attributes?.content.selection.value;
    if (!selection || selection === NO_SELECTION) return;

    const config = valueKey[selection];
    const result = tournamentEngine.generateTeamsFromParticipantAttribute({ ...config, addParticipants: false });
    if (result.newParticipants) {
      const methods = [
        {
          method: ADD_PARTICIPANTS,
          params: { participants: result.newParticipants }
        }
      ];
      mutationRequest({ methods, callback });
    }
  };

  context.modal.open({
    title: 'Create Team',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Create', intent: 'is-primary', onClick: createTeam, close: true }
    ],
    onClose: () => console.log('update teams')
  });
}
