/**
 * Choose the provider to work for — shown when an account belongs to more than one provider.
 *
 * CA, 2026-10-06: a user associated with several providers is never placed in one automatically. The last
 * pick is preselected; the user confirms. Dismissing it is signing out: there is no session without a choice.
 */
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

export type ChoosableProvider = {
  organisationAbbreviation?: string;
  organisationName?: string;
  providerId: string;
};

export function chooseProviderModal({
  lastSelectedProviderId,
  onChoose,
  onSignOut,
  providers,
}: {
  lastSelectedProviderId?: string | null;
  onChoose: (providerId: string) => void;
  onSignOut: () => void;
  providers: ChoosableProvider[];
}): void {
  const preselected = providers.some((p) => p.providerId === lastSelectedProviderId)
    ? (lastSelectedProviderId as string)
    : '';
  let chosen = preselected;
  let modalHandle: any;

  const options = [
    ...(preselected ? [] : [{ label: '', value: '' }]),
    ...providers.map((p) => ({
      label: p.organisationAbbreviation
        ? `${p.organisationName} (${p.organisationAbbreviation})`
        : (p.organisationName ?? p.providerId),
      value: p.providerId,
    })),
  ];

  const content = (elem: HTMLElement) => {
    const intro = document.createElement('p');
    intro.textContent = t('modals.chooseProvider.intro');
    elem.appendChild(intro);
    const form = document.createElement('div');
    elem.appendChild(form);
    renderForm(form, [
      {
        label: t('modals.chooseProvider.providerLabel'),
        field: 'provider',
        options,
        value: preselected,
        onChange: (event: Event) => {
          chosen = (event.target as HTMLSelectElement).value;
          modalHandle?.setButtonState('chooseProviderContinue', { disabled: !chosen });
        },
      },
    ]);
  };

  let decided = false;
  modalHandle = openModal({
    title: t('modals.chooseProvider.title'),
    content,
    onClose: () => {
      if (!decided) onSignOut();
    },
    buttons: [
      {
        label: t('modals.chooseProvider.signOut'),
        intent: 'none',
        close: true,
        onClick: () => {
          decided = true;
          onSignOut();
        },
      },
      {
        label: t('modals.chooseProvider.continue'),
        id: 'chooseProviderContinue',
        intent: 'is-primary',
        disabled: !preselected,
        close: true,
        onClick: () => {
          if (!chosen) return;
          decided = true;
          onChoose(chosen);
        },
      },
    ],
  });
}
