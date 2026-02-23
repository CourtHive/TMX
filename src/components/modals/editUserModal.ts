import { modifyUser } from 'services/apis/servicesApi';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

type EditUserModalParams = {
  user: any;
  providers?: any[];
  callback?: (res: any) => void;
};

export function editUserModal({ user, providers = [], callback }: EditUserModalParams): void {
  const userRoles = user?.roles || [];
  const userPermissions = user?.permissions || [];
  const userServices = user?.services || [];

  const noProvider: any = { value: { organisationName: 'None' }, key: '' };
  const providerList = [noProvider, ...providers].map(({ key, value }) => ({
    label: value?.organisationName,
    value: key,
  }));

  let inputs;
  const values = { providerId: user?.providerId || '' };
  const setProviderId = (value) => (values.providerId = value);

  const content = (elem) =>
    (inputs = renderForm(elem, [
      {
        iconLeft: 'fa-regular fa-envelope',
        value: user?.email || '',
        label: t('email'),
        field: 'email',
        disabled: true,
      },
      {
        text: t('modals.inviteUser.roles'),
        header: true,
      },
      {
        label: t('modals.inviteUser.client'),
        checked: userRoles.includes('client'),
        field: 'client',
        checkbox: true,
        width: '50%',
        id: 'editClient',
        fieldPair: {
          label: t('modals.inviteUser.director'),
          checked: userRoles.includes('director'),
          field: 'director',
          id: 'editDirector',
          checkbox: true,
        },
      },
      {
        label: t('modals.inviteUser.admin'),
        checked: userRoles.includes('admin'),
        checkbox: true,
        field: 'admin',
        width: '50%',
        id: 'editAdmin',
        fieldPair: {
          label: t('modals.inviteUser.official'),
          checked: userRoles.includes('official'),
          field: 'official',
          id: 'editOfficial',
          checkbox: true,
        },
      },
      {
        label: t('modals.inviteUser.scoring'),
        checked: userRoles.includes('score'),
        field: 'score',
        width: '50%',
        id: 'editScore',
        checkbox: true,
        fieldPair: {
          label: t('modals.inviteUser.developer'),
          checked: userRoles.includes('developer'),
          field: 'developer',
          id: 'editDeveloper',
          checkbox: true,
        },
      },
      {
        label: t('modals.inviteUser.generate'),
        checked: userRoles.includes('generate'),
        field: 'generate',
        checkbox: true,
        id: 'editGenerate',
      },
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
        checked: userPermissions.includes('deleteTournament'),
        field: 'deleteTournament',
        checkbox: true,
        id: 'editDelete',
      },
      {
        field: 'editTennisId',
        label: t('modals.inviteUser.editWtid'),
        checked: userPermissions.includes('editTennisId'),
        id: 'editEditTennisId',
        checkbox: true,
      },
      {
        label: t('modals.inviteUser.devMode'),
        checked: userPermissions.includes('devMode'),
        field: 'devMode',
        checkbox: true,
        id: 'editDevmode',
      },
      {
        text: t('modals.inviteUser.services'),
        header: true,
      },
      {
        label: t('modals.inviteUser.tournamentProfiles'),
        checked: userServices.includes('tournamentProfile'),
        field: 'tournamentProfile',
        id: 'editTournamentProfile',
        checkbox: true,
      },
    ]));

  const roles = ['client', 'admin', 'score', 'developer', 'generate', 'director', 'official'];
  const permissions = ['devMode', 'editTennisId', 'deleteTournament'];
  const services = ['tournamentProfile'];

  const submitEdit = () => {
    const email = user?.email;
    const providerId = values.providerId || inputs.providerId?.value;
    const userRolesSelected = roles.map((role) => inputs[role]?.checked && role).filter(Boolean);
    const userPermsSelected = permissions.map((perm) => inputs[perm]?.checked && perm).filter(Boolean);
    const userServicesSelected = services.map((svc) => inputs[svc]?.checked && svc).filter(Boolean);

    modifyUser({
      email,
      providerId,
      roles: userRolesSelected,
      permissions: userPermsSelected,
      services: userServicesSelected,
    }).then(
      (res) => {
        tmxToast({ message: t('system.userUpdated'), intent: 'is-success' });
        if (isFunction(callback)) callback(res);
      },
      (err) => console.log({ err }),
    );
  };

  openModal({
    title: t('system.editUserTitle'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('common.save'), intent: 'is-primary', onClick: submitEdit, close: true },
    ],
  });
}
