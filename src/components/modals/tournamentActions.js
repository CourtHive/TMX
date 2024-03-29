import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { sendTournament } from 'services/apis/servicesApi';
import { findAncestor } from 'services/dom/parentAndChild';
import { tmxToast } from 'services/notifications/tmxToast';
import { success } from 'components/notices/success';
import { failure } from 'components/notices/failure';
import { openModal } from './baseModal/baseModal';

// constants

export function tournamentActions() {
  const provider = tournamentEngine.getTournament().tournamentRecord?.parentOrganisation;
  const providerId = provider?.organisationId;

  let inputs;
  const takeAction = () => {
    if (inputs.action.value === 'upload' && inputs.replace.checked) {
      const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
      return tmxToast({
        action: {
          onClick: () => sendTournament({ tournamentRecord }).then(success, failure),
          text: 'Send??',
        },
        message: 'Upload tournament',
        intent: 'is-danger',
      });
    }

    if (inputs.action.value === 'claim') {
      return tmxToast({
        message: 'Claim tournament',
        intent: 'is-info',
      });
    }
  };

  const relationships = [
    {
      control: 'replace',
      onChange: ({ e }) => {
        const button = document.getElementById('go');
        button.disabled = !e.target.checked;
      },
    },
    {
      control: 'action',
      onChange: ({ e }) => {
        const replaceTick = document.getElementById('replace');
        const field = findAncestor(replaceTick, 'field');
        field.style.display = e.target.value === 'upload' ? 'block' : 'none';
        const button = document.getElementById('go');
        button.disabled = inputs.action.value === 'upload';
      },
    },
  ];
  const content = (elem) =>
    (inputs = renderForm(
      elem,
      [
        {
          options: [
            { label: '-- select action --', close: true },
            providerId && { label: 'Upload tournament', value: 'upload', close: true },
            { label: 'Delete tournament', disabled: true, value: 'delete', close: true },
            !providerId && { label: 'Claim tournament', value: 'claim', close: true },
            providerId && { label: 'Go Offline - standalone mode', value: 'offline', close: true },
          ].filter(Boolean),
          label: 'Action',
          field: 'action',
        },
        {
          label: 'Replace tournament on server',
          field: 'replace',
          visible: false,
          checkbox: true,
          id: 'replace',
        },
      ],
      relationships,
    ));

  openModal({
    title: 'Tournament Actions',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Go', id: 'go', intent: 'is-danger', disabled: true, onClick: takeAction, close: true },
    ],
  });
}
