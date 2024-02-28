import { emailValidator } from 'components/validators/emailValidator';
import { inviteUser } from 'services/authentication/authApi';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

export function inviteModal(callback, providers = []) {
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
          autocomplete: 'credit-card',
          validator: emailValidator,
          label: 'Email',
          field: 'email',
        },
        {
          typeAhead: { list: providerList, callback: setProviderId },
          placeholder: 'providerId',
          value: values.providerId,
          label: 'Provider Id',
          field: 'providerId',
        },
        {
          placeholder: 'client, admin, etc',
          autocomplete: 'credit-card',
          label: 'Roles',
          field: 'roles',
        },
      ],
      relationships,
    ));

  const submitInvite = () => {
    const email = inputs.email.value;
    const providerId = inputs.providerId.value;
    const roles = inputs.roles.value;
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
}
