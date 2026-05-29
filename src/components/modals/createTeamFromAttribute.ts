/**
 * Create teams from participant attributes modal.
 * Groups participants by country or city and creates team participants via mutation.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'courthive-components';
import { tournamentEngine } from 'services/factory/engine';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

import { ADD_PARTICIPANTS } from 'constants/mutationConstants';

const valueKey: Record<string, any> = {
  country: { personAttribute: 'nationalityCode' },
  city: { accessor: 'person.addresses.city' },
  // `teamAttribute` reads `person.biographicalInformation.teamAttributes[].teamName`.
  // `getAccessorValue` walks arrays automatically when no index is given, so the
  // accessor returns each entry's teamName — same shape the import wizard writes.
  teamAffiliation: { accessor: 'person.biographicalInformation.teamAttributes.teamName' },
};

export function createTeamsFromAttribute({ callback }: { callback?: () => void } = {}): void {
  const options = [
    { label: t('cnt'), value: 'country' },
    { label: t('cty'), value: 'city' },
    { label: t('modals.createTeam.teamAffiliation'), value: 'teamAffiliation' },
  ];

  const NO_SELECTION = '-';

  const content = (elem: HTMLElement) =>
    renderForm(elem, [
      {
        options: [{ label: t('modals.createTeam.selectAttribute'), value: NO_SELECTION }, ...options],
        label: t('attr'),
        field: 'selection',
        value: '',
      },
    ]);

  const createTeam = ({ content }: any) => {
    const selection = content?.selection.value;
    if (!selection || selection === NO_SELECTION) return;

    const config = valueKey[selection];
    const result = tournamentEngine.createTeamsFromParticipantAttributes({ ...config, addParticipants: false });
    if (result.newParticipants) {
      const methods = [
        {
          params: { participants: result.newParticipants },
          method: ADD_PARTICIPANTS,
        },
      ];
      mutationRequest({ methods, callback });
    }
  };

  openModal({
    title: t('modals.createTeam.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('modals.createTeam.create'), intent: 'is-primary', onClick: createTeam as any, close: true },
    ],
    onClose: () => {},
  });
}
