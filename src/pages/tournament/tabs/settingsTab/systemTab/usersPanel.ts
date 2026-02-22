import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { editUserModal } from 'components/modals/editUserModal';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { inviteModal } from 'components/modals/inviteUser';
import { removeUser } from 'services/apis/servicesApi';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tmxToast } from 'services/notifications/tmxToast';
import { copyClick } from 'services/dom/copyClick';
import { t } from 'i18n';

import { INVITE } from 'constants/tmxConstants';

const USERS_TABLE = 'systemUsersTable';

type RenderUsersPanelParams = {
  container: HTMLElement;
  providers: any[];
  users: any[];
  onRefresh: () => void;
};

export function renderUsersPanel({ container, providers, users, onRefresh }: RenderUsersPanelParams): void {
  container.innerHTML = '';

  // Build a provider lookup map
  const providerMap: Record<string, string> = {};
  (providers || []).forEach((p) => {
    if (p.key && p.value?.organisationName) {
      providerMap[p.key] = p.value.organisationName;
    }
    if (p.value?.organisationId && p.value?.organisationName) {
      providerMap[p.value.organisationId] = p.value.organisationName;
    }
  });

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'system-users-toolbar';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = t('system.searchUsers');
  searchInput.style.cssText = 'padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem; min-width: 200px;';

  const toolbarActions = document.createElement('div');
  toolbarActions.className = 'toolbar-actions';

  const inviteBtn = document.createElement('button');
  inviteBtn.className = 'btn-invite';
  inviteBtn.textContent = t('system.inviteUser');

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-edit';
  editBtn.textContent = t('system.editUser');

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-remove';
  removeBtn.textContent = t('system.removeUser');

  toolbarActions.appendChild(inviteBtn);
  toolbarActions.appendChild(editBtn);
  toolbarActions.appendChild(removeBtn);

  toolbar.appendChild(searchInput);
  toolbar.appendChild(toolbarActions);
  container.appendChild(toolbar);

  // Table
  const tableEl = document.createElement('div');
  tableEl.id = USERS_TABLE;
  container.appendChild(tableEl);

  const userData = (users || []).map((u) => ({
    firstName: u.value?.firstName || '',
    lastName: u.value?.lastName || '',
    email: u.value?.email || '',
    providerName: providerMap[u.value?.providerId] || '',
    roles: (u.value?.roles || []).join(', '),
    searchText: `${u.value?.firstName || ''} ${u.value?.lastName || ''} ${u.value?.email || ''}`.toLowerCase(),
    _raw: u,
  }));

  destroyTable({ anchorId: USERS_TABLE });

  const table = new Tabulator(tableEl, {
    placeholder: t('system.noUsers'),
    selectableRows: 1,
    layout: 'fitColumns',
    maxHeight: 500,
    columns: [
      { title: t('system.firstName'), field: 'firstName', headerSort: true },
      { title: t('system.lastName'), field: 'lastName', headerSort: true },
      { title: 'Email', field: 'email', headerSort: true },
      { title: t('system.provider'), field: 'providerName', headerSort: true },
      { title: t('system.roles'), field: 'roles', headerSort: false },
    ],
    data: userData,
  });

  // Search filter
  const setSearchFilter = createSearchFilter(table);
  searchInput.addEventListener('input', (e: any) => setSearchFilter(e.target.value));
  searchInput.addEventListener('keydown', (e: any) => {
    if (e.keyCode === 8 && e.target.value.length === 1) setSearchFilter('');
  });

  // Get selected user helper
  const getSelectedUser = () => {
    const rows = table.getSelectedRows();
    return rows?.[0]?.getData();
  };

  // Invite button
  inviteBtn.addEventListener('click', () => {
    const processInviteResult = (inviteResult) => {
      const inviteCode = inviteResult?.data?.inviteCode;
      if (inviteCode) {
        const inviteURL = `${window.location.origin}${window.location.pathname}/#/${INVITE}/${inviteCode}`;
        copyClick(inviteURL);
      }
      onRefresh();
    };
    inviteModal(processInviteResult, providers as any);
  });

  // Edit button
  editBtn.addEventListener('click', () => {
    const selected = getSelectedUser();
    if (!selected) {
      tmxToast({ message: t('system.selectUserFirst'), intent: 'is-warning' });
      return;
    }
    editUserModal({
      user: selected._raw?.value || selected,
      providers,
      callback: () => onRefresh(),
    });
  });

  // Remove button
  removeBtn.addEventListener('click', () => {
    const selected = getSelectedUser();
    if (!selected) {
      tmxToast({ message: t('system.selectUserFirst'), intent: 'is-warning' });
      return;
    }
    const displayName = `${selected.firstName} ${selected.lastName} (${selected.email})`;
    confirmModal({
      title: t('system.confirmRemoveUser'),
      query: `${t('system.removeUserConfirm')} ${displayName}?`,
      okIntent: 'is-danger',
      cancelAction: undefined,
      okAction: () => {
        removeUser({ email: selected.email }).then(() => {
          tmxToast({ message: `${displayName} removed`, intent: 'is-success' });
          onRefresh();
        });
      },
    });
  });
}
