import { nameValidator } from 'components/validators/nameValidator';
import { renderForm } from 'components/renderers/renderForm';
import { addProvider } from 'services/apis/servicesApi';
import { openModal } from './baseModal/baseModal';
import { tools } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';

// constants
import { NONE } from 'constants/tmxConstants';

export function createProviderModal(callback) {
  let inputs, imageLoaded;

  const clearImage = () => {
    const imageEl = document.getElementById('tournamentImagePreview');
    imageEl.style.display = NONE;
  };

  const attemptLoad = () => {
    enableSubmit({ inputs });
    imageLoaded = false;
    const imageEl = document.getElementById('tournamentImagePreview');
    imageEl.onload = () => (imageLoaded = true) && enableSubmit({ inputs });
    imageEl['src'] = inputs.tournamentImage.value;
    imageEl.style.display = '';
  };

  const enableSubmit = ({ inputs }) => {
    const isValid =
      (imageLoaded || !inputs.tournamentImage.value || imageLoaded === undefined) &&
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

  const form = (elem) =>
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
        {
          onKeyUp: (val) => val.key === 'Enter' && attemptLoad(),
          onChange: () => {
            return inputs.tournamentImage.value ? attemptLoad() : clearImage();
          },
          label: 'Web address of online image',
          placeholder: 'Image URL',
          field: 'tournamentImage',
          autocomplete: 'off',
        },
      ],
      relationships,
    ));

  const content = document.createElement('div');
  form(content);
  const image = document.createElement('img');
  image.id = 'tournamentImagePreview';

  image.style.width = '100%';
  content.appendChild(image);
  const submitProvider = () => {
    const organisationAbbreviation = inputs.providerAbbr.value;
    const organisationName = inputs.providerName.value;
    const organisationId = tools.UUID();

    const provider: any = { organisationAbbreviation, organisationName, organisationId };
    if (imageLoaded) {
      const url = inputs.tournamentImage.value;
      const onlineResource = {
        resourceSubType: 'IMAGE',
        name: 'tournamentImage',
        resourceType: 'URL',
        identifier: url,
      };
      provider.onlineResources = [onlineResource];
    }

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
        onClick: submitProvider,
        intent: 'is-primary',
        id: 'createButton',
        label: 'Create',
        disabled: true,
        close: true,
      },
    ],
  });
}
