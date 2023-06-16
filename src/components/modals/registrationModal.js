import { systemRegister } from 'services/authentication/authApi';
import { renderForm } from 'components/renderers/renderForm';
import { logIn } from 'services/authentication/loginState';
import { context } from 'services/context';

export function registrationModal({ providerId } = {}) {
  let inputs;

  const content = (elem) =>
    (inputs = renderForm(elem, [
      {
        iconLeft: 'fa-regular fa-user',
        placeholder: 'First name',
        autocomplete: 'firstName',
        label: 'First Name',
        field: 'firstName'
      },
      {
        iconLeft: 'fa-solid fa-house',
        placeholder: 'Last name',
        autocomplete: 'lastName',
        label: 'Last Name',
        field: 'lastName'
      },
      {
        iconLeft: 'fa-regular fa-envelope',
        placeholder: 'valid@email.com',
        autocomplete: 'email',
        label: 'Email',
        field: 'email'
      },
      {
        placeholder: 'minimum 8 characters',
        autocomplete: 'current-password',
        iconLeft: 'fa-solid fa-lock',
        label: 'Password',
        field: 'password',
        type: 'password'
      }
    ]));

  const submitCredentials = () => {
    const preferredFamilyName = inputs.lastName.value;
    const preferredGivenName = inputs.firstName.value;
    const password = inputs.password.value;
    const email = inputs.email.value;

    const inviteKey = 'foo'; // generate UUID and create key
    providerId = 'fe04375c6-405d-4526-8ed0-6a87a061aa71';

    const response = (res) => res?.status === 200 && logIn(res);
    systemRegister(preferredFamilyName, preferredGivenName, providerId, inviteKey, email, password).then(
      response,
      (err) => console.log({ err })
    );
  };

  context.modal.open({
    title: 'New User',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Register', intent: 'is-primary', onClick: submitCredentials, close: true }
    ]
  });
}
