import { renderForm } from 'components/renderers/renderForm';
import { getProviders } from 'services/apis/servicesApi';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

export async function selectProviderModal({ callback }) {
  const values = { providerId: '' };
  const response = await getProviders();
  const providers = response.data?.providers;
  const list = providers.map(({ value }) => ({
    label: value.organisationName,
    value: value.organisationId,
  }));
  const names = providers.map(({ value }) => value.organisationName);

  const selectProvider = () => {
    const provider = providers.find(({ value }) => value.organisationId === values.providerId)?.value;
    provider && isFunction(callback) && callback(provider);
  };

  const onInput = (el) => {
    const value = el.target.value;
    const enable = value === '' || names.includes(value);
    const selectButton = document.getElementById('selectButton');
    selectButton.disabled = !enable;
    values.providerId = enable ? value : '';
  };

  const typeAheadCallback = (providerId) => {
    const selectButton = document.getElementById('selectButton');
    values.providerId = providerId;
    selectButton.disabled = !providerId;
  };

  const content = (elem) => {
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
