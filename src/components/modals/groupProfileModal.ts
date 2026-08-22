/**
 * Group Profile Modal — a GROUP participant's membership, its relationship role, and what that role
 * does. Actionable: add and remove members without leaving it.
 *
 * A GROUP's membership IS `individualParticipantIds`. That is the whole model — there is no second
 * source, and deliberately no reuse of `teamProfileLogic.splitMembership`, which matches on
 * `person.biographicalInformation.teamAttributes[0].teamName`. That is a TEAM-import convention with
 * nothing to do with a group, and generalising it would tie group membership to a string match on a
 * team name.
 *
 * Why this exists at all: a TEAM row's name-click opened a rich profile while a GROUP row's name-click
 * toggled a collapse, and the only way to change membership was an unlabelled 20px chevron at the right
 * edge of the row. Groups were second-class in the UI, never in the model.
 *
 * The role note is the point of the header. A GROUP's `participantRole` is what escalates a
 * SHARED_GROUPING conflict from WARN to BLOCK when an official is assigned to a matchUp involving a
 * member — COACH / MEDICAL / PHYSIO / TRAINER under the bundled default policy, and *any* shared
 * grouping under the ITF variant. That rule is otherwise invisible until an assignment is refused.
 */
import { participantConstants, participantRoles, positionActionConstants, tools } from 'tods-competition-factory';
import { removeFromTeam } from 'pages/tournament/tabs/participantTab/controlBar/removeFromTeam';
import { roleBadge } from 'components/tables/common/formatters/roleBadge';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { tournamentEngine } from 'services/factory/engine';
import { selectParticipant } from './selectParticipant';
import { cModal } from 'courthive-components';
import { t } from 'i18n';

import { ADD_INDIVIDUAL_PARTICIPANT_IDS } from 'constants/mutationConstants';

const { ASSIGN_PARTICIPANT } = positionActionConstants;
const { INDIVIDUAL } = participantConstants;
const { COACH, MEDICAL, PHYSIO, TRAINER, OTHER } = participantRoles;
const xa = tools.extractAttributes;

/** Roles the bundled conflict policy escalates to BLOCK. Mirrors DISQUALIFYING_GROUP_ROLES in factory. */
const BLOCKING_ROLES = new Set<string>([COACH, MEDICAL, PHYSIO, TRAINER]);

export function groupProfileModal({ participantId, callback }: { participantId: string; callback?: () => void }): void {
  let table: any;

  const render = () => {
    const group = fetchGroup(participantId);
    if (!group) return undefined;

    const content = document.createElement('div');
    content.style.cssText = 'display: flex; flex-direction: column; gap: 1em;';
    content.appendChild(buildHeader(group));

    const tableEl = document.createElement('div');
    content.appendChild(tableEl);

    const members = group.individualParticipants ?? [];
    table = new Tabulator(tableEl, {
      placeholder: t('modals.groupProfile.empty'),
      height: members.length > 8 ? '320px' : undefined,
      layout: 'fitColumns',
      index: 'participantId',
      data: members.map(mapMember),
      columns: memberColumns(),
    });

    return { content, group };
  };

  const rendered = render();
  if (!rendered) return;

  const refresh = () => {
    const group = fetchGroup(participantId);
    table?.replaceData((group?.individualParticipants ?? []).map(mapMember));
    callback?.();
  };

  cModal.open({
    title: rendered.group.participantName || t('modals.groupProfile.title'),
    content: rendered.content,
    config: { maxWidth: 720 },
    onClose: () => table?.destroy?.(),
    buttons: [
      {
        label: t('modals.groupProfile.addMembers'),
        intent: 'is-info',
        onClick: () => addMembers(participantId, refresh),
      },
      {
        label: t('modals.groupProfile.removeSelected'),
        intent: 'is-danger',
        onClick: () => removeFromTeam({ table, team: fetchGroup(participantId), callback: refresh }),
      },
      { label: t('common.close'), close: true },
    ],
  });
}

function fetchGroup(participantId: string): any | undefined {
  const result = tournamentEngine.getParticipants({
    participantFilters: { participantIds: [participantId] },
    withIndividualParticipants: true,
    withISO2: true,
  });
  return result?.participants?.[0];
}

function buildHeader(group: any): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText =
    'display:flex; flex-direction:column; gap:0.4em; padding:0.75em 1em; border-radius:6px;' +
    'background:var(--tmx-bg-secondary); border:1px solid var(--tmx-border-primary);';

  const top = document.createElement('div');
  top.style.cssText = 'display:flex; align-items:center; gap:0.6em; flex-wrap:wrap;';

  const count = document.createElement('span');
  count.style.cssText = 'color:var(--tmx-text-secondary); font-size:0.9em;';
  count.textContent = t('modals.groupProfile.counts.members', { count: group.individualParticipantIds?.length ?? 0 });
  top.appendChild(count);

  const role = group.participantRole;
  if (role && role !== OTHER) {
    const badge = document.createElement('span');
    badge.innerHTML = roleBadge(role);
    top.appendChild(badge);
  }
  header.appendChild(top);

  // Make the otherwise-invisible rule visible at the moment a TD is looking at the group that carries it.
  if (BLOCKING_ROLES.has(role)) {
    const note = document.createElement('div');
    note.style.cssText = 'font-size:0.85em; color:var(--tmx-text-secondary); line-height:1.4;';
    note.textContent = t('modals.groupProfile.blockingRole', { role });
    header.appendChild(note);
  }

  return header;
}

function mapMember(p: any): any {
  const contact = Array.isArray(p.person?.contacts) ? p.person.contacts[0] : undefined;
  return {
    contact: contact?.mobileTelephone || contact?.telephone || contact?.emailAddress || '',
    participantName: p.participantName,
    participantId: p.participantId,
    role: p.participantRole,
  };
}

function memberColumns(): any[] {
  return [
    {
      cellClick: (_: any, cell: any) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      hozAlign: 'left',
      width: 40,
    },
    {
      title: t('modals.groupProfile.columns.role'),
      formatter: (cell: any) => roleBadge(cell.getValue()),
      field: 'role',
      headerSort: true,
      width: 140,
    },
    { title: t('modals.groupProfile.columns.name'), field: 'participantName', headerSort: true, minWidth: 180 },
    { title: t('modals.groupProfile.columns.contact'), field: 'contact', headerSort: false, minWidth: 160 },
  ];
}

/**
 * The picker is filtered by participantType ONLY — never by role. Putting an official or a coach into a
 * group alongside competitors is the entire point of a relationship group; a role filter here would
 * reproduce the empty-menu bug that made groups look unusable.
 */
function addMembers(groupingParticipantId: string, refresh: () => void): void {
  const group = fetchGroup(groupingParticipantId);
  const existing = new Set((group?.individualParticipants ?? []).map(xa('participantId')));

  const { participants = [] } = tournamentEngine.getParticipants({
    participantFilters: { participantTypes: [INDIVIDUAL] },
    withISO2: true,
  });

  const participantsAvailable = participants.filter(({ participantId }: any) => !existing.has(participantId));

  selectParticipant({
    title: t('modals.groupProfile.selectToAdd'),
    action: { type: ASSIGN_PARTICIPANT, participantsAvailable },
    onSelection: (result: any) => {
      const individualParticipantIds = (
        result?.selected ? result.selected.map(xa('participantId')) : [result?.participantId]
      ).filter(Boolean);
      if (!individualParticipantIds.length) return;

      const methods = [
        { method: ADD_INDIVIDUAL_PARTICIPANT_IDS, params: { groupingParticipantId, individualParticipantIds } },
      ];
      mutationRequest({ methods, callback: (r: any) => r?.success && refresh() });
    },
    selectionLimit: 99,
    activeOnEnter: true,
  });
}
