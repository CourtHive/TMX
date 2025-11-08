/**
 * Select provider modal with type-ahead search.
 * Allows selection of organization provider from available providers list.
 */
import { renderForm } from 'components/renderers/renderForm';
import { getProviders } from 'services/apis/servicesApi';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

export async function selectProviderModal({ callback }: { callback?: (provider: any) => void }): Promise<void> {
  const values = { providerId: '' };
  const response = await getProviders();
  const providers = response.data?.providers;
  const list = providers.map(({ value }: any) => ({
    label: value.organisationName,
    value: value.organisationId,
  }));
  const names = providers.map(({ value }: any) => value.organisationName);

  const selectProvider = () => {
    const provider = providers.find(({ value }: any) => value.organisationId === values.providerId)?.value;
    provider && isFunction(callback) && callback && callback(provider);
  };

  const onInput = (el: Event) => {
    const value = (el.target as HTMLInputElement).value;
    const enable = value === '' || names.includes(value);
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
        placeholder: 'Type provider name',
        label: 'Provider',
        field: 'provider',
        width: '100%',
        onInput,
      },
    ]);
  };
  openModal({
    title: 'Select provider',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      {
        onClick: selectProvider,
        intent: 'is-primary',
        id: 'selectButton',
        label: 'Select',
        disabled: true,
        close: true,
      },
    ],
  });
}
