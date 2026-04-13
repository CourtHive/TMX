/**
 * Manage Tournament Access modal — allows PROVIDER_ADMIN and SUPER_ADMIN users
 * to grant or revoke access for other users to a specific tournament.
 *
 * Launched from the Actions panel on the tournament overview page.
 */
import { openModal } from './baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { baseApi } from 'services/apis/baseApi';
import { t } from 'i18n';

interface AccessModalParams {
  tournamentId: string;
  tournamentName: string;
  providerId: string;
  onRefresh?: () => void;
}

const MTA_SECTION = 'mta-section';
const MTA_LABEL = 'mta-label';

export function manageTournamentAccess({ tournamentId, tournamentName, providerId, onRefresh }: AccessModalParams) {
  let assignmentsContainer: HTMLElement;
  let addInput: HTMLInputElement;
  let addButton: HTMLButtonElement;
  let eligibleUsers: any[] = [];

  const content = (elem: HTMLElement) => {
    elem.innerHTML = '';

    // Owner (read-only display)
    const ownerSection = document.createElement('div');
    ownerSection.className = MTA_SECTION;
    ownerSection.innerHTML = `<div class="mta-label">${t('system.tournament')}</div>
      <div class="mta-value">${tournamentName}</div>`;
    elem.appendChild(ownerSection);

    // Current assignments
    const assignmentsSection = document.createElement('div');
    assignmentsSection.className = MTA_SECTION;
    const assignmentsLabel = document.createElement('div');
    assignmentsLabel.className = MTA_LABEL;
    assignmentsLabel.textContent = t('modals.manageAccess.grantedAccess');
    assignmentsSection.appendChild(assignmentsLabel);

    assignmentsContainer = document.createElement('div');
    assignmentsContainer.className = 'mta-assignments';
    assignmentsSection.appendChild(assignmentsContainer);
    elem.appendChild(assignmentsSection);

    // Add user section
    const addSection = document.createElement('div');
    addSection.className = MTA_SECTION;
    const addLabel = document.createElement('div');
    addLabel.className = MTA_LABEL;
    addLabel.textContent = t('modals.manageAccess.addUser');
    addSection.appendChild(addLabel);

    const addRow = document.createElement('div');
    addRow.className = 'mta-add-row';

    addInput = document.createElement('input');
    addInput.type = 'email';
    addInput.className = 'mta-input';
    addInput.placeholder = t('modals.manageAccess.emailPlaceholder');
    addInput.setAttribute('list', 'mta-users-datalist');

    const datalist = document.createElement('datalist');
    datalist.id = 'mta-users-datalist';

    addButton = document.createElement('button');
    addButton.className = 'mta-grant-btn';
    addButton.textContent = t('modals.manageAccess.grant');
    addButton.addEventListener('click', handleGrant);

    addRow.appendChild(addInput);
    addRow.appendChild(datalist);
    addRow.appendChild(addButton);
    addSection.appendChild(addRow);
    elem.appendChild(addSection);

    // Load data
    loadAssignments();
    loadEligibleUsers(datalist);
  };

  async function loadAssignments() {
    try {
      const result = await baseApi.post('/factory/assignments/list', { tournamentId });
      const assignments = result?.data?.assignments ?? [];
      renderAssignments(assignments);
    } catch {
      assignmentsContainer.textContent = t('modals.manageAccess.loadError');
    }
  }

  async function loadEligibleUsers(datalist: HTMLElement) {
    try {
      const result = await baseApi.post('/factory/assignments/eligible-users', { providerId });
      eligibleUsers = result?.data?.users ?? [];
      datalist.innerHTML = '';
      for (const user of eligibleUsers) {
        const option = document.createElement('option');
        option.value = user.email;
        option.label = `${user.email} (${user.providerRole})`;
        datalist.appendChild(option);
      }
    } catch {
      // Silent — datalist just won't have suggestions
    }
  }

  function renderAssignments(assignments: any[]) {
    assignmentsContainer.innerHTML = '';
    if (assignments.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'mta-empty';
      empty.textContent = t('modals.manageAccess.noAssignments');
      assignmentsContainer.appendChild(empty);
      return;
    }
    for (const a of assignments) {
      const row = document.createElement('div');
      row.className = 'mta-assignment-row';

      const info = document.createElement('span');
      info.className = 'mta-assignment-email';
      info.textContent = a.email || a.userId;

      const role = document.createElement('span');
      role.className = 'mta-assignment-role';
      role.textContent = a.assignmentRole;

      const revokeBtn = document.createElement('button');
      revokeBtn.className = 'mta-revoke-btn';
      revokeBtn.textContent = t('modals.manageAccess.revoke');
      revokeBtn.addEventListener('click', () => handleRevoke(a.email));

      row.appendChild(info);
      row.appendChild(role);
      row.appendChild(revokeBtn);
      assignmentsContainer.appendChild(row);
    }
  }

  async function handleGrant() {
    const email = addInput.value.trim();
    if (!email) return;

    try {
      const result = await baseApi.post('/factory/assignments/grant', {
        tournamentId,
        userEmail: email,
        providerId,
      });
      if (result?.data?.error) {
        tmxToast({ message: result.data.error, intent: 'is-danger' });
        return;
      }
      tmxToast({ message: `${email} granted access`, intent: 'is-success' });
      addInput.value = '';
      loadAssignments();
      onRefresh?.();
    } catch (err: any) {
      tmxToast({ message: err?.message || t('modals.manageAccess.grantError'), intent: 'is-danger' });
    }
  }

  async function handleRevoke(email: string) {
    try {
      const result = await baseApi.post('/factory/assignments/revoke', {
        tournamentId,
        userEmail: email,
        providerId,
      });
      if (result?.data?.error) {
        tmxToast({ message: result.data.error, intent: 'is-danger' });
        return;
      }
      tmxToast({ message: `${email} access revoked`, intent: 'is-info' });
      loadAssignments();
      onRefresh?.();
    } catch (err: any) {
      tmxToast({ message: err?.message || t('modals.manageAccess.revokeError'), intent: 'is-danger' });
    }
  }

  openModal({
    title: t('modals.manageAccess.title'),
    content,
    buttons: [{ label: t('common.close'), intent: 'none', close: true }],
  });
}
