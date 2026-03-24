/**
 * Column definitions for participants table.
 * Displays participant details, ratings, sign-in status, events, and teams.
 * Rating columns are generated dynamically from participant data.
 */
import { participantProfileModal } from 'components/modals/participantProfileModal';
import { formatParticipant } from '../common/formatters/participantFormatter';
import { genderConstants, tournamentEngine } from 'tods-competition-factory';
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

export function getParticipantColumns({
  data,
  replaceTableData,
}: {
  data: any[];
  replaceTableData: () => void;
}): any[] {
  const cityState = data.some((p) => p.cityState);
  const tennisId = data.some((p) => p.tennisId);
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
      formatter: formatParticipant((params: any) => {
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
      }),
      sorter: participantSorter,
      field: 'participant',
      responsive: false,
      resizable: false,
      minWidth: 200,
      widthGrow: 2,
      title: t('tables.participants.name'),
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
      sorter: (a: any, b: any) => a?.[0]?.eventName?.localeCompare(b?.[0]?.eventName),
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
        const tournamentId = tournamentEngine.getTournament().tournamentRecord?.tournamentId;
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
