/**
 * Team Profile Modal — shows a TEAM participant's full membership split into
 * Roster (COMPETITORs), Coaches, and Staff (MEDICAL / CAPTAIN / OFFICIAL / …).
 *
 * The roster comes from `team.individualParticipantIds[]` — the authoritative
 * list the factory's draw / scoring engines consult. Coaches and staff are
 * NOT in that list (the factory's `createTeamsFromParticipantAttributes`
 * filters to `participantRole === COMPETITOR` by design); they are queried
 * separately from the tournament's full participant set by matching on
 * `person.biographicalInformation.teamAttributes[0].teamName` — the field
 * the import wizard writes on every imported person regardless of role.
 *
 * The modal is read-only in v1. Editing roster / role assignments stays on
 * the existing `editGroupingParticipant` rename form and the per-person
 * `editPlayer` page; both remain reachable via the popover.
 */
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { tournamentEngine } from 'services/factory/engine';
import { buildTeamCard, cModal } from 'courthive-components';
import { jerseySorter, splitMembership, type Member, type SplitMembership } from './teamProfileLogic';
import { t } from 'i18n';

export function teamProfileModal({ participantId }: { participantId: string }): void {
  const team = fetchTeam(participantId);
  if (!team) return;

  // splitMembership is now a pure function — pass the live participant set
  // in as a parameter so the helper itself stays test-friendly.
  const allParticipants = tournamentEngine.q.participants() ?? [];
  const { roster, coaches, staff } = splitMembership(team, allParticipants);

  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 1em;';

  content.appendChild(buildHeaderCard(team, { roster, coaches, staff }));

  const sections: Array<{ heading: string; rows: Member[]; isRoster: boolean }> = [
    { heading: t('modals.teamProfile.roster'), rows: roster, isRoster: true },
    { heading: t('modals.teamProfile.coaches'), rows: coaches, isRoster: false },
    { heading: t('modals.teamProfile.staff'), rows: staff, isRoster: false },
  ];

  const tables: any[] = [];

  for (const section of sections) {
    if (!section.rows.length) continue;
    const block = buildSection(section.heading, section.rows, section.isRoster);
    content.appendChild(block.element);
    tables.push(block.table);
  }

  if (!roster.length && !coaches.length && !staff.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding: 1em; opacity: 0.6; font-style: italic;';
    empty.textContent = t('modals.teamProfile.empty');
    content.appendChild(empty);
  }

  cModal.open({
    title: team.participantName || t('modals.teamProfile.title'),
    content,
    buttons: [{ label: t('common.close'), close: true }],
    config: { maxWidth: 900 },
    onClose: () => tables.forEach((table) => table?.destroy?.()),
  });
}

// ---- Data helpers ----------------------------------------------------------

function fetchTeam(participantId: string): any | undefined {
  const result = tournamentEngine.getParticipants({
    participantFilters: { participantIds: [participantId] },
    withIndividualParticipants: true,
    withScaleValues: true,
    withISO2: true,
  });
  return result?.participants?.[0];
}

// ---- Header card -----------------------------------------------------------

/**
 * Renders the modal header via the `buildTeamCard` primitive from
 * courthive-components. Count segments are pre-formatted here (with
 * locale-aware pluralization via `i18next`) so the primitive can stay
 * locale-agnostic.
 */
function buildHeaderCard(team: any, split: SplitMembership): HTMLElement {
  const countSegments: string[] = [];
  countSegments.push(formatCount(split.roster.length, 'players'));
  if (split.coaches.length) countSegments.push(formatCount(split.coaches.length, 'coaches'));
  if (split.staff.length) countSegments.push(formatCount(split.staff.length, 'staff'));

  return buildTeamCard({
    teamId: team.participantId,
    teamName: team.participantName || t('modals.teamProfile.title'),
    nickname: team.participantOtherName || undefined,
    countSegments,
  });
}

function formatCount(count: number, kind: string): string {
  return t(`modals.teamProfile.counts.${kind}`, { count });
}

// ---- Section blocks --------------------------------------------------------

function buildSection(
  heading: string,
  rows: Member[],
  isRoster: boolean,
): { element: HTMLElement; table: any } {
  const block = document.createElement('div');
  block.style.cssText = 'display: flex; flex-direction: column; gap: 0.4em;';

  const headingEl = document.createElement('div');
  headingEl.style.cssText = 'font-weight: 600; font-size: 1em; color: var(--tmx-text-primary, #eee);';
  headingEl.textContent = `${heading} (${rows.length})`;
  block.appendChild(headingEl);

  const tableEl = document.createElement('div');
  block.appendChild(tableEl);

  const data = rows.map((p) => mapRow(p, isRoster));
  const table = new Tabulator(tableEl, {
    layout: 'fitColumns',
    height: rows.length > 8 ? '320px' : undefined,
    placeholder: t('modals.teamProfile.empty'),
    data,
    columns: isRoster ? rosterColumns() : staffColumns(),
  });

  return { element: block, table };
}

function mapRow(p: Member, isRoster: boolean): any {
  const bio = p.person?.biographicalInformation;
  const attr = Array.isArray(bio?.teamAttributes) ? bio.teamAttributes[0] : undefined;
  const contact = Array.isArray(p.person?.contacts) ? p.person.contacts[0] : undefined;

  return {
    participantId: p.participantId,
    participantName: p.participantName,
    sex: p.person?.sex,
    role: p.participantRole,
    jerseyNumber: attr?.jerseyNumber,
    isRoster,
    contact: contact?.emailAddress || contact?.mobileTelephone || contact?.telephone || '',
  };
}

function rosterColumns(): any[] {
  return [
    {
      title: '#',
      field: 'jerseyNumber',
      width: 70,
      hozAlign: 'center',
      headerSort: true,
      sorter: jerseySorter,
      formatter: (cell: any) => {
        const v = cell.getValue();
        return v == null || v === '' ? '' : `<strong>${v}</strong>`;
      },
    },
    { title: t('modals.teamProfile.columns.name'), field: 'participantName', headerSort: true, minWidth: 180 },
    {
      title: t('modals.teamProfile.columns.sex'),
      field: 'sex',
      width: 80,
      hozAlign: 'center',
      headerSort: true,
      formatter: (cell: any) => formatSexBadge(cell.getValue()),
    },
  ];
}

function staffColumns(): any[] {
  return [
    {
      title: t('modals.teamProfile.columns.role'),
      field: 'role',
      width: 130,
      headerSort: true,
      formatter: (cell: any) => formatRoleBadge(cell.getValue()),
    },
    { title: t('modals.teamProfile.columns.name'), field: 'participantName', headerSort: true, minWidth: 180 },
    { title: t('modals.teamProfile.columns.contact'), field: 'contact', headerSort: false, minWidth: 200 },
  ];
}

function formatSexBadge(sex?: string): string {
  if (!sex) return '';
  const upper = sex.toUpperCase();
  const color = upper === 'FEMALE' ? '#c14070' : upper === 'MALE' ? '#3273dc' : '#888';
  const label = upper === 'FEMALE' ? 'F' : upper === 'MALE' ? 'M' : sex;
  return `<span style="display:inline-block; padding:0.1em 0.5em; border-radius:3px; font-size:0.85em; background:${color}22; border:1px solid ${color}66; color:var(--tmx-text-primary, #eee);">${label}</span>`;
}

function formatRoleBadge(role?: string): string {
  if (!role) return '';
  return `<span style="display:inline-block; padding:0.15em 0.55em; border-radius:3px; font-size:0.8em; background:var(--tmx-accent-blue, #3273dc)22; border:1px solid var(--tmx-accent-blue, #3273dc)55; color:var(--tmx-text-primary, #eee);">${role}</span>`;
}
