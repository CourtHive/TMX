import { validators, renderForm } from 'courthive-components';
import { inviteUser } from 'services/authentication/authApi';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

export function inviteModal(callback, providers = []) {
  const noProvider: any = { value: { organisationName: 'None' }, key: '' };
  const providerList = [noProvider, ...providers].map(({ key, value }) => ({
    label: value?.organisationName,
    value: key,
  }));
  let inputs;

  const values = { providerId: '' };

  const setProviderId = (value) => (values.providerId = value);

  const enableSubmit = ({ inputs }) => {
    const value = inputs['email'].value;
    const isValid = validators.emailValidator(value);
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
          validator: validators.emailValidator,
          autocomplete: 'off',
          label: t('email'),
          field: 'email',
        },
        {
          text: t('modals.inviteUser.roles'),
          header: true,
        },
        {
          label: t('modals.inviteUser.client'),
          field: 'client',
          checkbox: true,
          width: '50%',
          id: 'client',
          fieldPair: {
            label: t('modals.inviteUser.director'),
            field: 'director',
            id: 'director',
            checkbox: true,
          },
        },
        {
          label: t('modals.inviteUser.admin'),
          checkbox: true,
          field: 'admin',
          width: '50%',
          id: 'admin',
          fieldPair: {
            label: t('modals.inviteUser.official'),
            field: 'official',
            id: 'official',
            checkbox: true,
          },
        },
        {
          label: t('modals.inviteUser.scoring'),
          field: 'score',
          width: '50%',
          id: 'score',
          checkbox: true,
          fieldPair: {
            label: t('modals.inviteUser.developer'),
            field: 'developer',
            id: 'developer',
            checkbox: true,
          },
        },
        {
          label: t('modals.inviteUser.generate'),
          field: 'generate',
          checkbox: true,
          id: 'generate',
        },
        /* OPTION: Dropdown selector
        {
          value: values.providerId,
          options: providerList,
          field: 'providerId',
          label: 'Provider',
        },
        */
        {
          typeAhead: { list: providerList, callback: setProviderId },
          value: values.providerId || '',
          placeholder: t('none'),
          field: 'providerId',
          label: t('modals.inviteUser.provider'),
        },
        {
          text: t('modals.inviteUser.permissions'),
          header: true,
        },
        {
          label: t('modals.inviteUser.deleteTournaments'),
          field: 'deleteTournament',
          checkbox: true,
          id: 'delete',
        },
        {
          field: 'editTennisId',
          label: t('modals.inviteUser.editWtid'),
          id: 'editTennisId',
          checkbox: true,
        },
        {
          label: t('modals.inviteUser.devMode'),
          field: 'devMode',
          checkbox: true,
          id: 'devmode',
        },
        {
          text: t('modals.inviteUser.services'),
          header: true,
        },
        {
          label: t('modals.inviteUser.tournamentProfiles'),
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
    const email = inputs.email.value;
    const providerId = values.providerId || inputs.providerId?.value;
    const userPermissions = permissions.map((permission) => inputs[permission].checked && permission).filter(Boolean);
    const userServices = services.map((service) => inputs[service].checked && service).filter(Boolean);
    const userRoles = roles.map((role) => inputs[role].checked && role).filter(Boolean);
    const response = (res) => isFunction(callback) && callback(res);
    inviteUser(email, providerId, userRoles, userPermissions, userServices).then(response, (err) =>
      console.log({ err }),
    );
  };

  openModal({
    title: t('modals.inviteUser.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('modals.inviteUser.invite'), intent: 'is-primary', id: 'inviteUser', disabled: true, onClick: submitInvite, close: true },
    ],
  });
}
