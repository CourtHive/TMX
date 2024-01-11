import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { openModal } from './baseModal/baseModal';
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
        options: [{ label: 'Select attribute', value: NO_SELECTION }, ...options],
        label: 'Attribute',
        field: 'selection',
        value: ''
      }
    ]);

  const createTeam = ({ content }) => {
    const selection = content?.selection.value;
    if (!selection || selection === NO_SELECTION) return;

    const config = valueKey[selection];
    const result = tournamentEngine.createTeamsFromParticipantAttribute({ ...config, addParticipants: false });
    if (result.newParticipants) {
      const methods = [
        {
          params: { participants: result.newParticipants },
          method: ADD_PARTICIPANTS
        }
      ];
      mutationRequest({ methods, callback });
    }
  };

  openModal({
    title: 'Create Team',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Create', intent: 'is-primary', onClick: createTeam, close: true }
    ],
    onClose: () => {}
  });
}
