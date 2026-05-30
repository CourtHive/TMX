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
import { factoryConstants } from 'tods-competition-factory';
import { cModal } from 'courthive-components';
import { t } from 'i18n';

const { participantRoles, participantConstants } = factoryConstants;
const { COMPETITOR, COACH } = participantRoles;
const { INDIVIDUAL } = participantConstants;

// Members are typed loosely: the factory returns rich `HydratedParticipant`
// shapes that vary across query options (withScaleValues, withISO2, …) and
// the modal only reads a small handful of fields. Matching the existing
// `participantProfileModal.ts` convention of `any` here keeps the modal
// resilient to factory type-shape drift without changing what's displayed.
type Member = any;

type SplitMembership = {
  roster: Member[];
  coaches: Member[];
  staff: Member[];
};

export function teamProfileModal({ participantId }: { participantId: string }): void {
  const team = fetchTeam(participantId);
  if (!team) return;

  const { roster, coaches, staff } = splitMembership(team);

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

/**
 * Splits the team's membership into three buckets:
 *
 * - **Roster** — the union of `team.individualParticipants` (the
 *   authoritative roster the factory walks for draws / scoring) and any
 *   individual whose `teamAttributes[0].teamName` matches the team name AND
 *   has role COMPETITOR / no role. Union not strict equality so a roster
 *   entry with an empty `teamAttributes` (manual lineup, pre-import) still
 *   appears, and a freshly-imported COMPETITOR not yet attached to the team
 *   participant (race between the two ADD_PARTICIPANTS mutations) shows up
 *   immediately.
 * - **Coaches** — individuals matched on `teamAttributes.teamName` with
 *   `participantRole === COACH`. Never appear in `individualParticipantIds`
 *   because `createTeamsFromParticipantAttributes` filters them out.
 * - **Staff** — anything else with a matching `teamAttributes.teamName`
 *   (MEDICAL / CAPTAIN / OFFICIAL / VOLUNTEER / …). Each row carries its
 *   role for badge rendering.
 */
function splitMembership(team: any): SplitMembership {
  const teamName: string | undefined = team?.participantName;
  const teamRoster: Member[] = Array.isArray(team?.individualParticipants) ? team.individualParticipants : [];
  const rosterIds = new Set(teamRoster.map((m: Member) => m.participantId));

  const associated = teamName
    ? (tournamentEngine.q.participants() ?? []).filter((p: any) => {
        if (p.participantType !== INDIVIDUAL) return false;
        const recordedTeam = p.person?.biographicalInformation?.teamAttributes?.[0]?.teamName;
        return recordedTeam === teamName;
      })
    : [];

  const coaches: Member[] = [];
  const staff: Member[] = [];
  const rosterExtras: Member[] = [];

  for (const p of associated) {
    const role = p.participantRole;
    if (!role || role === COMPETITOR) {
      if (!rosterIds.has(p.participantId)) rosterExtras.push(p);
    } else if (role === COACH) {
      coaches.push(p);
    } else {
      staff.push(p);
    }
  }

  return {
    roster: [...teamRoster, ...rosterExtras],
    coaches,
    staff,
  };
}

// ---- Header card -----------------------------------------------------------

function buildHeaderCard(team: any, split: SplitMembership): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = `
    padding: 1em 1.25em;
    border: 1px solid var(--tmx-border-secondary, #555);
    border-radius: 6px;
    background: var(--tmx-bg-secondary, #2c2c2c);
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  `;

  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display: flex; align-items: baseline; gap: 0.75em; flex-wrap: wrap;';

  const name = document.createElement('span');
  name.style.cssText = 'font-size: 1.25em; font-weight: 600; color: var(--tmx-text-primary, #eee);';
  name.textContent = team.participantName || t('modals.teamProfile.title');
  titleRow.appendChild(name);

  if (team.participantOtherName) {
    const nickname = document.createElement('span');
    nickname.style.cssText = 'font-size: 0.95em; opacity: 0.7; font-style: italic;';
    nickname.textContent = `"${team.participantOtherName}"`;
    titleRow.appendChild(nickname);
  }

  card.appendChild(titleRow);

  const counts = document.createElement('div');
  counts.style.cssText = 'display: flex; gap: 1em; font-size: 0.9em; opacity: 0.85; flex-wrap: wrap;';

  const summarySegments: string[] = [];
  summarySegments.push(formatCount(split.roster.length, 'players'));
  if (split.coaches.length) summarySegments.push(formatCount(split.coaches.length, 'coaches'));
  if (split.staff.length) summarySegments.push(formatCount(split.staff.length, 'staff'));

  counts.textContent = summarySegments.join(' · ');
  card.appendChild(counts);

  return card;
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

function jerseySorter(a: any, b: any): number {
  const na = parseJersey(a);
  const nb = parseJersey(b);
  if (na == null && nb == null) return 0;
  if (na == null) return 1;
  if (nb == null) return -1;
  return na - nb;
}

function parseJersey(value: any): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
