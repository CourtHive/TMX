/**
 * Column definitions for rounds table.
 * Displays match schedule, participants, scores, and completion status.
 */
import { participantMatchUpActions } from '../../popovers/participantMatchUpActions';
import { competitiveProfileSorter } from '../common/sorters/competitiveProfileSorter';
import { formatParticipant } from '../common/formatters/participantFormatter';
import { participantSorter } from '../common/sorters/participantSorter';
import { profileFormatter } from '../common/formatters/profileFormatter';
import { scoreFormatter } from '../common/formatters/scoreFormatter';
import { matchUpActions } from 'components/popovers/matchUpActions';
import { handleScoreClick } from './handleMatchUpScoreClick';
import { tournamentEngine } from 'tods-competition-factory';
import { scoreSorter } from '../common/sorters/scoreSorter';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';
import { context } from 'services/context';

import { CENTER, LEFT, RIGHT, SCHEDULE_TAB, TOURNAMENT } from 'constants/tmxConstants';
import { t } from 'i18n';

export function getRoundsColumns({ data, replaceTableData }: { data: any[]; replaceTableData: () => void }): any[] {
  const matchUpScheduleClick = (_e: Event, cell: any) => {
    const row = cell.getRow();
    const data = row.getData();
    const { courtName, scheduledDate } = data;
    if (courtName && scheduledDate) {
      const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
      const route = `/${TOURNAMENT}/${tournamentId}/${SCHEDULE_TAB}/${scheduledDate}`;
      context.router.navigate(route);
    }
  };

  const participantChange = () => replaceTableData();
  const showCourts = data.some((m) => m.courtName);

  const handleSideClick = (e: Event, cell: any) => participantMatchUpActions(e, cell, participantChange);

  const matchUpParticipantFormatter = (cell: any) => {
    const placholder = document.createElement('div');
    placholder.className = 'has-text-warning-dark';
    placholder.innerHTML = 'Select participant';
    const onClick = ({ event, ...params }: any) => {
      participantMatchUpActions(event, cell, participantChange, params);
    };

    const value = cell.getValue();
    return value.participantName && (formatParticipant(onClick) as any)(cell, placholder);
  };

  return [
    {
      cellClick: (_e: Event, cell: any) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      formatter: 'responsiveCollapse',
      headerSort: false,
      resizable: false,
      hozAlign: CENTER,
      minWidth: 50,
      width: 50,
    },
    {
      headerMenu: headerMenu({
        duration: 'Duration',
        complete: 'Complete',
      }),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55,
    },
    {
      title: t('tables.rounds.flight'),
      visible: false,
      minWidth: 150,
      field: 'flight',
      widthGrow: 1,
    },
    {
      cellClick: matchUpScheduleClick,
      field: 'scheduledDate',
      title: t('tables.rounds.date'),
      width: 110,
    },
    {
      cellClick: matchUpScheduleClick,
      visible: !!showCourts,
      field: 'courtName',
      title: t('tables.rounds.court'),
      width: 100,
    },
    {
      cellClick: matchUpScheduleClick,
      field: 'scheduleTime',
      headerSort: false,
      visible: false,
      title: t('tables.rounds.time'),
      width: 70,
    },
    {
      formatter: matchUpParticipantFormatter,
      cellClick: handleSideClick,
      sorter: participantSorter,
      responsive: false,
      title: t('tables.rounds.side1'),
      minWidth: 180,
      field: 'side1',
      widthGrow: 1,
    },
    {
      formatter: matchUpParticipantFormatter,
      cellClick: handleSideClick,
      sorter: participantSorter,
      responsive: false,
      title: t('tables.rounds.side2'),
      minWidth: 180,
      field: 'side2',
      widthGrow: 1,
    },
    {
      cellClick: handleScoreClick(replaceTableData),
      formatter: scoreFormatter,
      sorter: scoreSorter,
      field: 'scoreDetail',
      responsive: false,
      title: t('tables.rounds.score'),
      width: 140,
    },
    {
      sorter: competitiveProfileSorter,
      formatter: profileFormatter,
      field: 'competitiveProfile',
      responsive: false,
      title: t('tables.rounds.profile'),
      visible: false,
      width: 140,
    },
    {
      title: `<div class='fa-solid fa-check' style='color: green' />`,
      formatter: 'tickCross',
      field: 'complete',
      hozAlign: LEFT,
      tooltip: false,
      width: 40,
    },
    {
      field: 'matchUp.matchUpStatus',
      title: t('tables.rounds.status'),
      width: 150,
    },
    {
      title: `<div class='fa-solid fa-clock' style='color: blue' />`,
      headerSort: false,
      field: 'duration',
      visible: false,
      width: 70,
    },
    {
      cellClick: (e: Event, cell: any) => matchUpActions({ pointerEvent: e as PointerEvent, ...cell.getData() }),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      widthGrow: 0,
      width: 50,
    },
  ];
}
