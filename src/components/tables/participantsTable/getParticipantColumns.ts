/**
 * Column definitions for participants table.
 * Displays participant details, ratings, sign-in status, events, and teams.
 * Rating columns are generated dynamically from participant data.
 */
import { participantProfileModal } from 'components/modals/participantProfileModal';
import { formatParticipant } from '../common/formatters/participantFormatter';
import { tournamentEngine } from 'services/factory/engine';
import { genderConstants } from 'tods-competition-factory';
import { arrayLengthFormatter } from '../common/formatters/arrayLength';
import { participantSorter } from '../common/sorters/participantSorter';
import { participantActions } from '../../popovers/participantActions';
import { eventsFormatter } from '../common/formatters/eventsFormatter';
import { teamsFormatter } from '../common/formatters/teamsFormatter';
import { applyColumnVisibility } from '../common/columnIsVisible';
import { getRatingColumns } from '../common/getRatingColumns';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { toggleSignInStatus } from './toggleSignInStatus';
import { idEditor } from '../common/editors/idEditor';
import { headerMenu } from '../common/headerMenu';
import { t } from 'i18n';

// constants
import { CENTER, LEFT, PARTICIPANTS, RIGHT } from 'constants/tmxConstants';
import { context } from 'services/context';

const { FEMALE, MALE } = genderConstants;

/** Numeric-aware sort for the Jersey # column. Empty / non-numeric strings
 *  sink to the bottom so the column reads top-to-bottom by jersey number. */
function jerseySorter(a: any, b: any): number {
  const na = a == null || a === '' ? Number.POSITIVE_INFINITY : Number(a);
  const nb = b == null || b === '' ? Number.POSITIVE_INFINITY : Number(b);
  const ax = Number.isFinite(na) ? na : Number.POSITIVE_INFINITY;
  const bx = Number.isFinite(nb) ? nb : Number.POSITIVE_INFINITY;
  if (ax === bx) return 0;
  return ax - bx;
}

/** Inline role badge — matches the visual treatment used by
 *  `teamProfileModal.ts`'s Staff section so the same role rendering carries
 *  across the modal and this table. */
function roleBadgeFormatter(cell: any): string {
  const role = cell.getValue();
  if (!role) return '';
  return `<span style="display:inline-block; padding:0.15em 0.55em; border-radius:3px; font-size:0.8em; background:var(--tmx-accent-blue, #3273dc)22; border:1px solid var(--tmx-accent-blue, #3273dc)55; color:var(--tmx-text-primary, #eee);">${role}</span>`;
}

export function getParticipantColumns({
  data,
  replaceTableData,
}: {
  data: any[];
  replaceTableData: () => void;
}): any[] {
  const cityState = data.some((p) => p.cityState);
  const tennisId = data.some((p) => p.tennisId);
  const jerseyNumberPresent = data.some((p) => p.jerseyNumber);
  const teamAffiliationPresent = data.some((p) => p.teamAffiliation);
  const rolePresent = data.some((p) => p.participantRole);
  const ratingColumns = getRatingColumns(data, 'participant');

  return applyColumnVisibility([
    {
      cellClick: (_: Event, cell: any) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      headerMenu: headerMenu({
        signedIn: 'Sign In Status',
        sex: 'Gender',
      }),
      formatter: 'rownum',
      headerSort: false,
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      width: 65,
    },
    {
      formatter: formatParticipant(
        (params: any) => {
          const clickedParticipant = params?.individualParticipant || params?.participant;
          const rowData = params?.cell?.getRow().getData();
          if (!rowData) return;
          const { participantType } = rowData;
          if (participantType !== 'INDIVIDUAL') return;
          const participantId = clickedParticipant?.participantId || rowData.participantId;
          if (!participantId) return;
          const table = params?.cell?.getTable();
          if (!table) return;
          const participantIds = (table.getData() as any[])
            .filter((r: any) => r.participantType === 'INDIVIDUAL')
            .map((r: any) => r.participantId);
          participantProfileModal({ participantId, participantIds });
        },
        { useParticipantName: true },
      ),
      sorter: participantSorter,
      field: 'participant',
      responsive: false,
      resizable: false,
      minWidth: 200,
      widthGrow: 2,
      title: t('tables.participants.name'),
    },
    {
      // Jersey number lives on `person.biographicalInformation.teamAttributes[0]
      // .jerseyNumber`. Surfaced for Competitors view (and any other view) when
      // any row has one — auto-hides for sports / tournaments that don't track
      // them. Pre-sorts top-to-bottom so the roster reads in jersey order.
      title: '#',
      field: 'jerseyNumber',
      visible: jerseyNumberPresent,
      sorter: jerseySorter,
      headerSort: true,
      hozAlign: CENTER,
      width: 60,
      formatter: (cell: any) => {
        const v = cell.getValue();
        return v == null || v === '' ? '' : `<strong>${v}</strong>`;
      },
    },
    {
      // Per-row `participantRole` badge. Critical for the Staff view where
      // every row is a different non-COMPETITOR role; hidden by default
      // elsewhere because Competitors are all COMPETITOR by definition.
      title: t('tables.participants.role'),
      field: 'participantRole',
      visible: rolePresent,
      formatter: roleBadgeFormatter,
      headerSort: true,
      width: 130,
    },
    {
      // Team affiliation from `teamAttributes[0].teamName` — the import wizard
      // populates this on every imported person regardless of role. Visible
      // when any row has a value so the column appears in Staff view (where
      // it's essential) and Competitors view (where it shows the imported
      // team affiliation pre-team-generation).
      title: t('tables.participants.teamAffiliation'),
      field: 'teamAffiliation',
      visible: teamAffiliationPresent,
      headerSort: true,
      headerFilter: 'input',
      minWidth: 140,
    },
    {
      editor: idEditor({ field: 'tennisId' }),
      visible: tennisId,
      field: 'tennisId',
      editable: false,
      title: t('tables.participants.wtid'),
      width: 120,
    },
    {
      headerFilter: 'input',
      title: t('tables.participants.firstName'),
      field: 'firstName',
      visible: false,
      width: 150,
    },
    {
      headerFilter: 'input',
      title: t('tables.participants.lastName'),
      field: 'lastName',
      visible: false,
      width: 150,
    },
    {
      formatter: (cell: any, formatterParams: any, onRendered: any) => {
        if (!cell.getValue()) return '';
        return formatParticipant(
          (params: any) => {
            const clickedParticipant = params?.individualParticipant || params?.participant;
            const rowData = params?.cell?.getRow().getData();
            if (!rowData) return;
            const { participantType } = rowData;
            if (participantType !== 'INDIVIDUAL') return;
            const participantId = clickedParticipant?.participantId || rowData.participantId;
            if (!participantId) return;
            const table = params?.cell?.getTable();
            if (!table) return;
            const participantIds = (table.getData() as any[])
              .filter((r: any) => r.participantType === 'INDIVIDUAL')
              .map((r: any) => r.participantId);
            participantProfileModal({ participantId, participantIds });
          },
        )(cell, formatterParams, onRendered);
      },
      title: t('tables.participants.nickname'),
      visible: data.some((p) => p.nickname),
      field: 'nickname',
      width: 150,
    },
    {
      title: '<i class="fa-solid fa-venus-mars" />',
      formatter: (cell: any) => {
        const value = cell.getValue();
        if (value === 'Male') return t('pages.participants.gender.male');
        if (value === 'Female') return t('pages.participants.gender.female');
        return value || t('pages.participants.gender.unknown');
      },
      field: 'sex',
      hozAlign: LEFT,
      editor: 'list',
      width: 80,
      editorParams: {
        itemFormatter: (_: any, value: any) => value,
        values: {
          [t('pages.participants.gender.male')]: MALE,
          [t('pages.participants.gender.female')]: FEMALE,
          '': t('pages.participants.gender.unknown'),
        },
      },
    },
    { title: t('tables.participants.country'), field: 'ioc', width: 130, visible: false, headerFilter: 'input' },
    {
      title: `<div class='fa-solid fa-check' style='color: var(--tmx-accent-green)' />`,
      cellClick: toggleSignInStatus,
      formatter: 'tickCross',
      resizable: false,
      field: 'signedIn',
      hozAlign: LEFT,
      tooltip: false,
      width: 40,
    },
    {
      sorter: (a: any, b: any) => (a.length || 0) - (b?.length || 0),
      formatter: arrayLengthFormatter,
      title: t('tables.participants.penalties'),
      field: 'penalties',
      hozAlign: LEFT,
      visible: false,
      width: 130,
    },
    {
      headerFilter: 'input',
      title: t('tables.participants.club'),
      field: 'club',
      hozAlign: LEFT,
      minWidth: 70,
      editor: false,
      visible: false,
    },
    {
      sorter: (a: any, b: any) => a?.[0]?.eventName?.localeCompare(b?.[0]?.eventName, undefined, { numeric: true }),
      formatter: eventsFormatter(navigateToEvent),
      title: t('tables.participants.events'),
      field: 'events',
      hozAlign: LEFT,
      minWidth: 200,
      editor: false,
      widthGrow: 2,
    },
    {
      sorter: (a: any, b: any) => a?.[0]?.participantName?.localeCompare(b?.[0]?.participantName),
      formatter: teamsFormatter(() => {
        const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
        if (tournamentId) context.router?.navigate(`/tournament/${tournamentId}/${PARTICIPANTS}/TEAM`);
      }),
      title: t('tables.participants.teams'),
      field: 'teams',
      hozAlign: LEFT,
      minWidth: 200,
      editor: false,
      widthGrow: 2,
    },
    {
      visible: !!cityState,
      title: t('tables.participants.cityState'),
      field: 'cityState',
      minWidth: 110,
    },
    ...ratingColumns,
    {
      cellClick: participantActions(replaceTableData),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      maxWidth: 40,
    },
  ]);
}
