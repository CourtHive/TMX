import BulmaTagsInput from '@creativebulma/bulma-tagsinput';
import { emailValidator } from 'components/validators/emailValidator';
import { inviteUser } from 'services/authentication/authApi';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

export function inviteModal(callback, providers = []) {
  const providerList = providers.map(({ key, value }) => ({ label: value.organisationName, value: key }));
  const delimiter = ',';
  let inputs;

  const values = { providerId: '' };

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
          text: 'Roles',
          header: true,
        },
        {
          label: 'Client',
          field: 'client',
          checkbox: true,
          id: 'client',
        },
        {
          label: 'Admin',
          checkbox: true,
          field: 'admin',
          id: 'admin',
        },
        {
          label: 'Scoring',
          field: 'Score',
          id: 'Score',
          checkbox: true,
        },
        {
          label: 'Developer',
          field: 'developer',
          id: 'developer',
          checkbox: true,
        },
        {
          label: 'Generate',
          field: 'generate',
          checkbox: true,
          id: 'generate',
        },
        {
          value: values.providerId,
          options: providerList,
          field: 'providerId',
          label: 'Provider',
        },
        {
          text: 'Permissions',
          header: true,
        },
        {
          label: 'Dev mode',
          field: 'devMode',
          checkbox: true,
          id: 'devmode',
        },
      ],
      relationships,
    ));

  const roles = ['client', 'admin', 'Score', 'developer', 'generate'];
  const permissions = ['devMode'];
  const submitInvite = () => {
    const email = inputs.email.value;
    const providerId = inputs.providerId.value;
    const userPermissions = permissions.map((permission) => inputs[permission].checked && permission).filter(Boolean);
    const userRoles = roles.map((role) => inputs[role].checked && role).filter(Boolean);
    const response = (res) => isFunction(callback) && callback(res);
    inviteUser(email, providerId, userRoles, userPermissions).then(response, (err) => console.log({ err }));
  };

  openModal({
    title: 'Invite user',
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
