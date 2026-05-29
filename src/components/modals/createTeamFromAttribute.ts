/**
 * Create teams from participant attributes modal.
 * Groups participants by country or city and creates team participants via mutation.
 */
import { FactoryError, unwrap } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'courthive-components';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
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
    try {
      // The factory method returns one of two success shapes depending on
      // `addParticipants`: `{participantsAdded}` or `{newParticipants}`.
      // We pass `addParticipants: false`, so the second shape applies —
      // narrow at the consumer boundary.
      const { newParticipants } = unwrap(
        tournamentEngine.createTeamsFromParticipantAttributes({ ...config, addParticipants: false }),
      ) as { newParticipants?: any[] };
      if (!newParticipants?.length) return;
      const methods = [{ params: { participants: newParticipants }, method: ADD_PARTICIPANTS }];
      mutationRequest({ methods, callback });
    } catch (e) {
      tmxToast({
        message: e instanceof FactoryError ? e.message : 'Failed to create teams',
        intent: 'is-danger',
      });
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
