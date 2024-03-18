import { nameValidator } from 'components/validators/nameValidator';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';
import { tools } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { addProvider } from 'services/apis/servicesApi';

export function createProviderModal(callback) {
  let inputs;

  const enableSubmit = ({ inputs }) => {
    const isValid =
      nameValidator(10)(inputs.providerName.value) &&
      nameValidator(3)(inputs.providerAbbr.value) &&
      (!inputs.providerId.value.length || nameValidator(36)(inputs.providerId.value));
    const createButton: any = document.getElementById('createButton');
    if (createButton) createButton.disabled = !isValid;
  };

  const relationships = [
    {
      control: 'providerAbbr',
      onInput: enableSubmit,
    },
    {
      control: 'providerName',
      onInput: enableSubmit,
    },
    {
      control: 'providerId',
      onInput: enableSubmit,
    },
  ];

  const content = (elem) =>
    (inputs = renderForm(
      elem,
      [
        {
          placeholder: 'Provider name',
          validator: nameValidator(10),
          label: 'Provider Name',
          field: 'providerName',
          autocomplete: 'off',
        },
        {
          placeholder: 'Abbreviation',
          validator: nameValidator(3),
          label: 'Abbreviation',
          field: 'providerAbbr',
          autocomplete: 'off',
        },
        {
          placeholder: 'NOT REQUIRED - automatically generated',
          label: 'Provider ID',
          autocomplete: 'off',
          field: 'providerId',
        },
      ],
      relationships,
    ));

  const submitProvider = () => {
    const organisationAbbreviation = inputs.providerAbbr.value;
    const organisationName = inputs.providerName.value;
    const organisationId = tools.UUID();

    const provider = { organisationAbbreviation, organisationName, organisationId };

    const response = (res) => {
      console.log(res);
      isFunction(callback) && callback(res);
    };
    addProvider({ provider }).then(response, (err) => console.log({ err }));
  };

  openModal({
    title: 'Create provider',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      {
        label: 'Invite',
        intent: 'is-primary',
        id: 'createButton',
        disabled: true,
        onClick: submitProvider,
        close: true,
      },
    ],
  });
}
