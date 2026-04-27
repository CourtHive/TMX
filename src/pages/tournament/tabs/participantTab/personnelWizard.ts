import { tournamentEngine, participantRoles } from 'tods-competition-factory';
import { editIndividualParticipant } from './editIndividualParticipant';
import { openModal } from 'components/modals/baseModal/baseModal';
import { providerConfig } from 'config/providerConfig';
import { t } from 'i18n';

const { OFFICIAL } = participantRoles;

interface RequiredRole {
  label: string;
  icon: string;
}

const STANDARD_ROLES: RequiredRole[] = [
  { label: 'Tournament Director', icon: 'fa-user-tie' },
  { label: 'Referee', icon: 'fa-gavel' },
  { label: 'Chief Umpire', icon: 'fa-flag' },
  { label: 'Medical Officer', icon: 'fa-medkit' },
];

function getExistingOfficialNames(): string[] {
  const { participants } = tournamentEngine.getParticipants({
    participantFilters: { participantRoles: [OFFICIAL] },
    withIndividualParticipants: true,
  });

  return (participants || []).map((p: any) => {
    const person = p.person || {};
    return [person.standardGivenName, person.standardFamilyName].filter(Boolean).join(' ').toLowerCase();
  });
}

export function openPersonnelWizard({ callback }: { callback: () => void }): void {
  const existingNames = getExistingOfficialNames();
  const existingCount = existingNames.length;

  const content = document.createElement('div');
  content.style.padding = '8px';

  const intro = document.createElement('p');
  intro.style.cssText = 'margin-bottom:12px; font-size:0.9rem; color:var(--tmx-text-secondary);';
  intro.textContent = existingCount
    ? `${existingCount} official(s) already added. Add any missing tournament personnel below.`
    : 'No tournament officials found. Add standard personnel roles to get started.';
  content.appendChild(intro);

  const roleList = document.createElement('div');
  roleList.style.cssText = 'display:flex; flex-direction:column; gap:8px;';

  for (const role of STANDARD_ROLES) {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:6px; border:1px solid var(--tmx-border-primary); cursor:pointer; transition:background 0.15s;';

    row.addEventListener('mouseenter', () => {
      row.style.background = 'var(--tmx-bg-secondary)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.background = '';
    });

    const icon = document.createElement('i');
    icon.className = `fa ${role.icon}`;
    icon.style.cssText = 'font-size:1.1rem; width:24px; text-align:center; color:var(--tmx-text-secondary);';
    row.appendChild(icon);

    const label = document.createElement('span');
    label.style.cssText = 'flex:1; font-size:0.9rem; font-weight:500;';
    label.textContent = role.label;
    row.appendChild(label);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.style.cssText =
      'padding:4px 12px; border-radius:4px; border:1px solid var(--tmx-border-primary); background:var(--tmx-bg-primary); color:var(--tmx-text-primary); cursor:pointer; font-size:0.8rem;';
    addBtn.innerHTML = '<i class="fa fa-plus"></i> Add';
    const canAddOfficials = providerConfig.isAllowed('canCreateOfficials');
    if (!canAddOfficials) {
      addBtn.disabled = true;
      addBtn.style.opacity = '0.4';
      addBtn.title = 'Provider does not allow adding officials';
    } else {
      addBtn.addEventListener('click', () => {
        editIndividualParticipant({ callback, view: OFFICIAL });
      });
    }
    row.appendChild(addBtn);

    roleList.appendChild(row);
  }

  content.appendChild(roleList);

  openModal({
    title: 'Add Tournament Personnel',
    content,
    config: { maxWidth: 480, padding: '1' },
    buttons: [{ label: t('common.close'), intent: 'none', close: true }],
  });
}
