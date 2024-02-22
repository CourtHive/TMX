import { logIn, logOut } from 'services/authentication/loginState';
import { systemLogin } from 'services/authentication/authApi';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';

export function loginModal(callback) {
  let inputs;

  const content = (elem) =>
    (inputs = renderForm(elem, [
      {
        iconLeft: 'fa-regular fa-envelope',
        placeholder: 'valid@email.com',
        autocomplete: 'email',
        label: 'Email',
        field: 'email',
      },
      {
        placeholder: 'minimum 8 characters',
        autocomplete: 'current-password',
        iconLeft: 'fa-solid fa-lock',
        label: 'Password',
        field: 'password',
        type: 'password',
      },
    ]));

  const submitCredentials = () => {
    const email = inputs.email.value;
    const password = inputs.password.value;
    const response = (res) => {
      !res && logOut();
      res?.status === 200 && logIn({ data: res.data, callback });
    };
    systemLogin(email, password).then(response, (err) => console.log({ err }));
  };

  openModal({
    title: 'Log in',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Login', intent: 'is-primary', onClick: submitCredentials, close: true },
    ],
  });
}
