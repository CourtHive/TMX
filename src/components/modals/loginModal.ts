/**
 * Login modal with email and password validation.
 * Authenticates user credentials and updates login state on success.
 */
import { emailValidator } from 'components/validators/emailValidator';
import { logIn, logOut } from 'services/authentication/loginState';
import { systemLogin } from 'services/authentication/authApi';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';

export function loginModal(callback?: () => void): void {
  let inputs: any;

  const enableSubmit = ({ inputs }: any) => {
    const value = inputs['email'].value;
    const isValid = emailValidator(value);
    const inviteButton = document.getElementById('loginButton');
    if (inviteButton) (inviteButton as HTMLButtonElement).disabled = !isValid;
  };

  const relationships = [
    {
      onInput: enableSubmit,
      control: 'email',
    },
  ];

  const content = (elem: HTMLElement) =>
    (inputs = renderForm(
      elem,
      [
        {
          iconLeft: 'fa-regular fa-envelope',
          placeholder: 'valid@email.com',
          validator: emailValidator,
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
      ],
      relationships,
    ));

  const submitCredentials = () => {
    const email = inputs.email.value;
    const password = inputs.password.value;
    const response = (res: any) => {
      if (!res) logOut();
      if (res?.status === 200) logIn({ data: res.data, callback });
    };
    systemLogin(email, password).then(response, (err: any) => console.log({ err }));
  };

  openModal({
    title: 'Log in',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      {
        onClick: submitCredentials,
        intent: 'is-primary',
        id: 'loginButton',
        disabled: true,
        label: 'Login',
        close: true,
      },
    ],
  });
}
