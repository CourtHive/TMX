/**
 * Select provider modal with type-ahead search.
 * Allows selection of organization provider from available providers list.
 */
import { getProviders } from 'services/apis/servicesApi';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

export async function selectProviderModal({ callback }: { callback?: (provider: any) => void }): Promise<void> {
  const values = { providerId: '' };
  const response = await getProviders();
  const providers = response.data?.providers;
  const list = providers.map(({ value }: any) => ({
    label: value.organisationName,
    value: value.organisationId,
  }));
  const names = new Set(providers.map(({ value }: any) => value.organisationName));

  const selectProvider = () => {
    const provider = providers.find(({ value }: any) => value.organisationId === values.providerId)?.value;
    if (provider && isFunction(callback)) callback(provider);
  };

  const onInput = (el: Event) => {
    const value = (el.target as HTMLInputElement).value;
    const enable = value === '' || names.has(value);
    const selectButton = document.getElementById('selectButton') as HTMLButtonElement;
    selectButton.disabled = !enable;
    values.providerId = enable ? value : '';
  };

  const typeAheadCallback = (providerId: string) => {
    const selectButton = document.getElementById('selectButton') as HTMLButtonElement;
    values.providerId = providerId;
    selectButton.disabled = !providerId;
  };

  const content = (elem: HTMLElement) => {
    renderForm(elem, [
      {
        typeAhead: { list, callback: typeAheadCallback },
        placeholder: t('modals.selectProvider.placeholder'),
        label: t('modals.selectProvider.providerLabel'),
        field: 'provider',
        width: '100%',
        onInput,
      },
    ]);
  };
  openModal({
    title: t('modals.selectProvider.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      {
        onClick: selectProvider,
        intent: 'is-primary',
        id: 'selectButton',
        label: t('select'),
        disabled: true,
        close: true,
      },
    ],
  });
}
