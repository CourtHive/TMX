import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getLoginState } from 'services/authentication/loginState';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { sendTournament } from 'services/apis/servicesApi';
import { findAncestor } from 'services/dom/parentAndChild';
import { tmxToast } from 'services/notifications/tmxToast';
import { downloadUTRmatches } from 'services/export/UTR';
import { downloadJSON } from 'services/export/download';
import { success } from 'components/notices/success';
import { failure } from 'components/notices/failure';
import { openModal } from './baseModal/baseModal';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';

// constants
import { ADD_TOURNAMENT_TIMEITEM } from 'constants/mutationConstants';
import { ADMIN } from 'constants/tmxConstants';

// constants

export function tournamentActions() {
  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
  const offline = tournamentRecord?.timeItems?.find(({ itemType }) => itemType === 'TMX')?.itemValue?.offline;
  const provider = tournamentRecord?.parentOrganisation;
  const providerId = provider?.organisationId;
  const state = getLoginState();
  const canDelete = state?.permissions?.includes('deleteTournament');
  const admin = state?.roles?.includes(ADMIN);

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

    if (inputs.action.value === 'claim' && state?.provider) {
      const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
      if (!tournamentRecord.parentOrganisation) {
        tournamentRecord.parentOrganisation = state.provider;
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

    if (inputs.action.value === 'goOffline' && state?.provider) {
      const postMutation = (result) => {
        if (result?.success) {
          saveTournamentRecord();
          const dnav = document.getElementById('dnav');
          dnav.style.backgroundColor = 'lightyellow';
          tmxToast({ message: 'Offline', intent: 'is-info' });
        }
      };
      changeOnlineState({ postMutation, state, offline: true });
    }

    if (inputs.action.value === 'goOnline' && state?.provider) {
      /**
       * 1. remove offline property from TMX timeItem
       * 2. send tournament to server
       * 3. if success, remove local copy of tournament; if failure, set offline property back to true
       */
      const postMutation = (result) => {
        if (result?.success) {
          const success = () => {
            tmx2db.deleteTournament(tournamentRecord.tournamentId);
            const dnav = document.getElementById('dnav');
            dnav.style.backgroundColor = '';
            tmxToast({ message: 'Online', intent: 'is-info' });
          };
          const failure = (err) => {
            console.log({ err });
            changeOnlineState({ state, offline: true });
          };

          const updatedTournamentRecord = tournamentEngine.getTournament().tournamentRecord;
          // this will send the tournament to the server
          sendTournament({ tournamentRecord: updatedTournamentRecord }).then(success, failure);
        }
      };
      // this will only change the online state locally
      changeOnlineState({ postMutation, state, offline: false });
    }

    if (inputs.action.value === 'utrExport') downloadUTRmatches();
    if (inputs.action.value === 'todsExport') {
      if (tournamentRecord) {
        downloadJSON(`${tournamentRecord.tournamentId}.tods.json`, tournamentRecord);
      } else {
        tmxToast({ message: 'Error' });
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
            { label: 'Delete tournament', disabled: !canDelete, value: 'delete', close: true },
            tournamentRecord &&
              !providerId &&
              state?.provider && { label: 'Claim tournament', value: 'claim', close: true },
            providerId && !offline && { label: 'Go offline - standalone mode', value: 'goOffline', close: true },
            providerId && offline && { label: 'Go online - exit standalone mode', value: 'goOnline', close: true },
            admin && { label: 'Export UTR matches', value: 'utrExport' },
            admin && { label: 'Export TODS file', value: 'todsExport' },
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
    title: 'Tournament actions',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Go', id: 'go', intent: 'is-danger', disabled: true, onClick: takeAction, close: true },
    ],
  });
}

function changeOnlineState({ postMutation, state, offline }) {
  const itemValue = { ...(tournamentEngine.getTournamentTimeItem({ itemType: 'TMX' })?.timeItem ?? {}).itemValue };
  if (offline) {
    itemValue.offline = { email: state.email };
  } else {
    delete itemValue.offline;
  }
  const timeItem = { itemType: 'TMX', itemValue };
  mutationRequest({
    methods: [{ method: ADD_TOURNAMENT_TIMEITEM, params: { removePriorValues: true, timeItem } }],
    callback: postMutation,
  });
}
