import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { editProviderModal } from 'components/modals/editProvider';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { inviteModal } from 'components/modals/inviteUser';
import { destroyTable } from 'pages/tournament/destroyTable';
import { context } from 'services/context';
import { t } from 'i18n';

import { TMX_TOURNAMENTS } from 'constants/tmxConstants';

const PROVIDER_LIST_TABLE = 'systemProviderListTable';
const PROVIDER_USERS_TABLE = 'systemProviderUsersTable';

type RenderProvidersPanelParams = {
  container: HTMLElement;
  providers: any[];
  users: any[];
  onRefresh: () => void;
};

export function renderProvidersPanel({ container, providers, users, onRefresh }: RenderProvidersPanelParams): void {
  container.innerHTML = '';

  // Toolbar (matches usersPanel pattern)
  const toolbar = document.createElement('div');
  toolbar.className = 'system-users-toolbar';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = t('system.searchProviders');
  searchInput.style.cssText = 'padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem; min-width: 200px;';

  const toolbarActions = document.createElement('div');
  toolbarActions.className = 'toolbar-actions';

  const createBtn = document.createElement('button');
  createBtn.className = 'btn-invite';
  createBtn.textContent = t('system.createProvider');
  createBtn.addEventListener('click', () => editProviderModal({ callback: () => onRefresh() }));

  toolbarActions.appendChild(createBtn);

  toolbar.appendChild(searchInput);
  toolbar.appendChild(toolbarActions);
  container.appendChild(toolbar);

  const layout = document.createElement('div');
  layout.className = 'system-providers-layout';

  // Left pane: provider list
  const listPane = document.createElement('div');
  listPane.className = 'system-provider-list';
  const listTableEl = document.createElement('div');
  listTableEl.id = PROVIDER_LIST_TABLE;
  listPane.appendChild(listTableEl);

  // Right pane: provider detail
  const detailPane = document.createElement('div');
  detailPane.className = 'system-provider-detail';
  detailPane.innerHTML = `<div class="system-no-selection">${t('system.selectProvider')}</div>`;

  layout.appendChild(listPane);
  layout.appendChild(detailPane);
  container.appendChild(layout);

  const providerData = (providers || []).map((p) => ({
    organisationName: p.value?.organisationName || '',
    organisationAbbreviation: p.value?.organisationAbbreviation || '',
    organisationId: p.value?.organisationId || p.key || '',
    searchText: `${p.value?.organisationName || ''} ${p.value?.organisationAbbreviation || ''}`.toLowerCase(),
    _raw: p,
  }));

  destroyTable({ anchorId: PROVIDER_LIST_TABLE });

  const table = new Tabulator(listTableEl, {
    placeholder: t('system.noProviders'),
    selectableRows: 1,
    layout: 'fitColumns',
    maxHeight: 500,
    columns: [
      { title: t('system.providerName'), field: 'organisationName', headerSort: true },
      { title: t('system.providerAbbr'), field: 'organisationAbbreviation', headerSort: true },
    ],
    data: providerData,
  });

  table.on('rowSelectionChanged', (_data, rows) => {
    const selected = rows?.[0]?.getData();
    if (selected) {
      renderProviderDetail({ detailPane, provider: selected, providers, users, onRefresh });
    } else {
      detailPane.innerHTML = `<div class="system-no-selection">${t('system.selectProvider')}</div>`;
    }
  });

  // Search filter
  const setSearchFilter = createSearchFilter(table);
  searchInput.addEventListener('input', (e: any) => setSearchFilter(e.target.value));
  searchInput.addEventListener('keydown', (e: any) => {
    if (e.keyCode === 8 && e.target.value.length === 1) setSearchFilter('');
  });
}

type RenderProviderDetailParams = {
  detailPane: HTMLElement;
  provider: any;
  providers: any[];
  users: any[];
  onRefresh: () => void;
};

function renderProviderDetail({ detailPane, provider, providers, users, onRefresh }: RenderProviderDetailParams): void {
  detailPane.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'system-detail-header';
  header.innerHTML = `
    <h3>${provider.organisationName}</h3>
    <div class="detail-meta">${provider.organisationAbbreviation} &middot; ${provider.organisationId}</div>
  `;
  detailPane.appendChild(header);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'system-detail-actions';

  const impersonateBtn = document.createElement('button');
  impersonateBtn.className = 'btn-impersonate';
  impersonateBtn.textContent = t('system.impersonate');
  impersonateBtn.addEventListener('click', () => {
    context.provider = provider._raw?.value || {
      organisationName: provider.organisationName,
      organisationAbbreviation: provider.organisationAbbreviation,
      organisationId: provider.organisationId,
    };
    context.router?.navigate(`/${TMX_TOURNAMENTS}/${provider.organisationAbbreviation}`);
  });

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-edit';
  editBtn.textContent = t('system.editProvider');
  editBtn.addEventListener('click', () => {
    const providerValue = provider._raw?.value || {
      organisationName: provider.organisationName,
      organisationAbbreviation: provider.organisationAbbreviation,
      organisationId: provider.organisationId,
    };
    editProviderModal({ provider: providerValue, callback: () => onRefresh() });
  });

  const inviteBtn = document.createElement('button');
  inviteBtn.className = 'btn-invite';
  inviteBtn.textContent = t('system.inviteUser');
  inviteBtn.addEventListener('click', () => {
    const processInviteResult = (result: any) => {
      if (result?.success) onRefresh();
    };
    inviteModal(processInviteResult, providers as any, provider.organisationId);
  });

  actions.appendChild(impersonateBtn);
  actions.appendChild(editBtn);
  actions.appendChild(inviteBtn);
  detailPane.appendChild(actions);

  // Associated users
  const assocSection = document.createElement('div');
  assocSection.className = 'system-associated-users';
  assocSection.innerHTML = `<h4>${t('system.associatedUsers')}</h4>`;

  const assocTableEl = document.createElement('div');
  assocTableEl.id = PROVIDER_USERS_TABLE;
  assocSection.appendChild(assocTableEl);
  detailPane.appendChild(assocSection);

  const filteredUsers = (users || [])
    .filter((u) => u.value?.providerId === provider.organisationId)
    .map((u) => ({
      firstName: u.value?.firstName || '',
      lastName: u.value?.lastName || '',
      email: u.value?.email || '',
      roles: (u.value?.roles || []).join(', '),
      searchText: `${u.value?.firstName || ''} ${u.value?.lastName || ''} ${u.value?.email || ''}`.toLowerCase(),
    }));

  destroyTable({ anchorId: PROVIDER_USERS_TABLE });

  new Tabulator(assocTableEl, {
    placeholder: t('system.noUsersForProvider'),
    layout: 'fitColumns',
    maxHeight: 300,
    columns: [
      { title: t('system.firstName'), field: 'firstName', headerSort: true },
      { title: t('system.lastName'), field: 'lastName', headerSort: true },
      { title: 'Email', field: 'email', headerSort: true },
      { title: t('system.roles'), field: 'roles', headerSort: false },
    ],
    data: filteredUsers,
  });
}
