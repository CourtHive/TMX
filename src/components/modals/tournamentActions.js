import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getLoginState } from 'services/authentication/loginState';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { sendTournament } from 'services/apis/servicesApi';
import { findAncestor } from 'services/dom/parentAndChild';
import { tmxToast } from 'services/notifications/tmxToast';
import { success } from 'components/notices/success';
import { failure } from 'components/notices/failure';
import { openModal } from './baseModal/baseModal';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';

// constants
import { ADD_TOURNAMENT_TIMEITEM } from 'constants/mutationConstants';

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
      const state = getLoginState();
      const provider = state?.provider;
      if (provider) {
        const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
        if (!tournamentRecord.parentOrganisation) {
          tournamentRecord.parentOrganisation = provider;
          tournamentEngine.setState(tournamentRecord); // update tournamentEngine state with provider
          const success = () => {
            tmx2db.deleteTournament(tournamentRecord.tournamentId);
            context.router.navigate(`/tournament/${tournamentRecord.tournamentId}/detail`);
            tmxToast({
              message: 'Tournament claimed',
              intent: 'is-info',
            });
          };
          const failure = (error) => {
            tmxToast({
              message: error.message || 'Not claimed',
              intent: 'is-danger',
            });
          };
          sendTournament({ tournamentRecord }).then(success, failure);
        }
      }
    }

    if (inputs.action.value === 'offline') {
      const state = getLoginState();
      const provider = state?.provider;
      if (provider) {
        const itemValue = (tournamentEngine.getTournamentTimeItem({ itemType: 'TMX' })?.timeItem ?? {}).itemValue;
        itemValue.offline = { email: state.email };
        const timeItem = {
          itemType: 'TMX',
          itemValue,
        };
        const postMutation = (result) => {
          if (result?.success) {
            saveTournamentRecord();
            tmxToast({
              message: 'Offline',
              intent: 'is-info',
            });
          }
        };
        mutationRequest({
          methods: [{ method: ADD_TOURNAMENT_TIMEITEM, params: { removePriorValues: true, timeItem } }],
          callback: postMutation,
        });
      }
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
            providerId && { label: 'Go offline - standalone mode', value: 'offline', close: true },
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
