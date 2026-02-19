import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { tournamentHeader } from 'components/popovers/tournamentHeader';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm, validators } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { t } from 'i18n';

// connstants
import { SET_TOURNAMENT_NAME } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function openEditTournamentNameModal(): void {
  const { tournamentInfo } = tournamentEngine.getTournamentInfo();
  const tournamentName = tournamentInfo?.tournamentName || '';

  let inputs: any;

  const enableSubmit = () => {
    const valid = validators.nameValidator(5)(inputs['tournamentName'].value);
    const saveButton = document.getElementById('saveTournamentName');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !valid;
  };

  const items = [
    {
      error: t('modals.editTournamentName.nameError'),
      placeholder: t('modals.editTournamentName.namePlaceholder'),
      value: tournamentName,
      validator: validators.nameValidator(5),
      label: t('modals.editTournamentName.nameLabel'),
      field: 'tournamentName',
      focus: true,
    },
  ];

  const relationships = [{ control: 'tournamentName', onInput: enableSubmit }];

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, items, relationships);
  };

  const onClick = () => {
    const newName = inputs['tournamentName'].value?.trim();
    const methods = [{ method: SET_TOURNAMENT_NAME, params: { tournamentName: newName } }];
    const postMutation = (result: any) => {
      if (result?.success) {
        closeModal();
        tournamentHeader();
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const valid = validators.nameValidator(5)(tournamentName);

  openModal({
    title: t('modals.editTournamentName.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('common.save'), id: 'saveTournamentName', disabled: !valid, intent: 'is-primary', onClick },
    ],
  });
}
