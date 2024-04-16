import { emailValidator } from 'components/validators/emailValidator';
import { inviteUser } from 'services/authentication/authApi';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

export function inviteModal(callback, providers = []) {
  const noProvider: any = { value: { organisationName: 'None' }, key: '' };
  const providerList = [noProvider, ...providers].map(({ key, value }) => ({
    label: value?.organisationName,
    value: key,
  }));
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
          validator: emailValidator,
          autocomplete: 'off',
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
          width: '50%',
          id: 'client',
          fieldPair: {
            label: 'Director',
            field: 'director',
            id: 'director',
            checkbox: true,
          },
        },
        {
          label: 'Admin',
          checkbox: true,
          field: 'admin',
          width: '50%',
          id: 'admin',
          fieldPair: {
            label: 'Official',
            field: 'official',
            id: 'official',
            checkbox: true,
          },
        },
        {
          label: 'Scoring',
          field: 'score',
          width: '50%',
          id: 'score',
          checkbox: true,
          fieldPair: {
            label: 'Developer',
            field: 'developer',
            id: 'developer',
            checkbox: true,
          },
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
          label: 'Delete Tournaments',
          field: 'deleteTournament',
          checkbox: true,
          id: 'delete',
        },
        {
          field: 'editTennisId',
          label: 'Edit WTID',
          id: 'editTennisId',
          checkbox: true,
        },
        {
          label: 'Dev mode',
          field: 'devMode',
          checkbox: true,
          id: 'devmode',
        },
        {
          text: 'Services',
          header: true,
        },
        {
          label: 'Tournament Profiles',
          field: 'tournamentProfile',
          id: 'tournamentProfile',
          checkbox: true,
        },
      ],
      relationships,
    ));

  const roles = ['client', 'admin', 'score', 'developer', 'generate', 'director', 'official'];
  const permissions = ['devMode', 'editTennisId', 'deleteTournament'];
  const services = ['tournamentProfile'];
  const submitInvite = () => {
    console.log({ inputs });
    const email = inputs.email.value;
    const providerId = inputs.providerId.value;
    const userPermissions = permissions.map((permission) => inputs[permission].checked && permission).filter(Boolean);
    const userServices = services.map((service) => inputs[service].checked && service).filter(Boolean);
    const userRoles = roles.map((role) => inputs[role].checked && role).filter(Boolean);
    const response = (res) => isFunction(callback) && callback(res);
    inviteUser(email, providerId, userRoles, userPermissions, userServices).then(response, (err) =>
      console.log({ err }),
    );
  };

  openModal({
    title: 'Invite user',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Invite', intent: 'is-primary', id: 'inviteUser', disabled: true, onClick: submitInvite, close: true },
    ],
  });
}
