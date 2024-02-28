import BulmaTagsInput from '@creativebulma/bulma-tagsinput';
import { emailValidator } from 'components/validators/emailValidator';
import { inviteUser } from 'services/authentication/authApi';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

export function inviteModal(callback, providers = []) {
  const delimiter = ',';
  let inputs;

  const values = { providerId: '' };

  const setProviderId = (value) => (values.providerId = value);
  const providerList = providers.map(({ key, value }) => ({ label: value.organisationName, value: key }));

  const enableSubmit = ({ inputs }) => {
    const value = inputs['email'].value;
    const isValid = emailValidator(value);
    const inviteButton: any = document.getElementById('inviteUser');
    if (inviteButton) inviteButton.disabled = !isValid;
  };

  const relationships = [
    {
      onInput: enableSubmit,
      control: 'email',
    },
  ];

  const content = (elem) =>
    (inputs = renderForm(
      elem,
      [
        {
          iconLeft: 'fa-regular fa-envelope',
          placeholder: 'valid@email.com',
          autocomplete: 'cc-number',
          validator: emailValidator,
          label: 'Email',
          field: 'email',
        },
        {
          label: 'User Roles',
          dataType: 'tags',
          zIndex: '99999',
          multiple: true,
          field: 'roles',
          id: 'roles',
          type: 'tags',
          options: [
            { label: 'Developer', value: 'developer' },
            { label: 'Generate', value: 'generate' },
            { label: 'Client', value: 'client' },
            { label: 'Admin', value: 'admin' },
            { label: 'Score', value: 'score' },
          ],
        },
        {
          typeAhead: { list: providerList, callback: setProviderId },
          placeholder: 'providerId',
          value: values.providerId,
          label: 'Provider Id',
          field: 'providerId',
        },
      ],
      relationships,
    ));

  const submitInvite = () => {
    const email = inputs.email.value;
    const providerId = inputs.providerId.value;
    const roles = inputs.roles.BulmaTagsInput().items.map(({ value }) => value);
    const response = (res) => isFunction(callback) && callback(res);
    inviteUser(email, providerId, roles).then(response, (err) => console.log({ err }));
  };

  openModal({
    title: 'Log in',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Invite', intent: 'is-primary', id: 'inviteUser', disabled: true, onClick: submitInvite, close: true },
    ],
  });

  BulmaTagsInput.attach(inputs.roles, {
    closeDropdownOnItemSelect: true,
    clearSelectionOnTyping: false,
    noResultsLabel: 'not found',
    delimiter,
    maxTags: 2,
  });
  const div = document.getElementById('roles');
  const input = div.querySelector('input');
  input.style.width = 'auto';
}
