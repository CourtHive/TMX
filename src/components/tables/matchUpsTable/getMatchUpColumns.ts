/**
 * Column definitions for matchUps table.
 * Displays match details, participants, scores, schedule, and completion status.
 */
import { participantMatchUpActions } from '../../popovers/participantMatchUpActions';
import { competitiveProfileSorter } from '../common/sorters/competitiveProfileSorter';
import { formatParticipant } from '../common/formatters/participantFormatter';
import { participantSorter } from '../common/sorters/participantSorter';
import { profileFormatter } from '../common/formatters/profileFormatter';
import { eventFormatter } from '../common/formatters/eventsFormatter';
import { scoreFormatter } from '../common/formatters/scoreFormatter';
import { titleFormatter } from '../common/formatters/titleFormatter';
import { matchUpActions } from 'components/popovers/matchUpActions';
import { tournamentEngine, tools } from 'tods-competition-factory';
import { handleScoreClick } from './handleMatchUpScoreClick';
import { navigateToEvent } from '../common/navigateToEvent';
import { scoreSorter } from '../common/sorters/scoreSorter';
import { threeDots } from '../common/formatters/threeDots';
import { setMatchUpSchedule } from './setMatchUpSchedule';
import { timePicker } from 'components/modals/timePicker';
import { headerMenu } from '../common/headerMenu';
import { context } from 'services/context';
import { highlightTab } from 'navigation';

import { LEFT, RIGHT, SCHEDULE_TAB, TOURNAMENT } from 'constants/tmxConstants';

export function getMatchUpColumns({ data, replaceTableData, setFocusData }: { data: any[]; replaceTableData: () => void; setFocusData?: (data: any) => void }): any[] {
  const matchUpScheduleClick = (_e: Event, cell: any) => {
    const row = cell.getRow();
    const data = row.getData();
    const { courtName, scheduledDate } = data;
    if (courtName && scheduledDate) {
      const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
      const route = `/${TOURNAMENT}/${tournamentId}/${SCHEDULE_TAB}/${scheduledDate}`;
      context.router.navigate(route);
      highlightTab(SCHEDULE_TAB);
    }
  };

  const matchUpTimeClick = (_e: Event, cell: any) => {
    const existingTime = cell.getValue();
    const timeSelected = ({ time }: { time: string }) => {
      const militaryTime = true;
      const scheduledTime = tools.dateTime.convertTime(time, militaryTime);
      const row = cell.getRow();
      const data = row.getData();
      const { matchUpId } = data;
      if (scheduledTime !== existingTime) {
        const callback = () => {
          console.log('callback');
          row.update({ ...data, scheduledTime });
        };
        setMatchUpSchedule({ matchUpId, schedule: { scheduledTime }, callback });
      }
    };
    timePicker({ time: existingTime, callback: timeSelected });
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
      formatter: eventFormatter(navigateToEvent),
      field: 'eventId',
      title: 'Event',
      visible: true,
      minWidth: 200,
      widthGrow: 1,
    },
    {
      title: 'Flight',
      visible: false,
      minWidth: 150,
      field: 'flight',
      widthGrow: 1,
    },
    {
      field: 'matchUpType',
      titleFormatter,
      title: 'Type',
      minWidth: 90,
    },
    {
      field: 'roundName',
      title: 'Round',
      titleFormatter,
      minWidth: 90,
    },
    {
      cellClick: matchUpScheduleClick,
      field: 'scheduledDate',
      title: 'Date',
      width: 110,
    },
    {
      cellClick: matchUpScheduleClick,
      visible: !!showCourts,
      field: 'courtName',
      title: 'Court',
      width: 100,
    },
    {
      cellClick: matchUpTimeClick,
      field: 'scheduledTime',
      visible: true,
      title: 'Time',
      width: 70,
    },
    {
      formatter: matchUpParticipantFormatter,
      cellClick: handleSideClick,
      sorter: participantSorter,
      responsive: false,
      title: 'Side 1',
      minWidth: 180,
      field: 'side1',
      widthGrow: 1,
    },
    {
      formatter: matchUpParticipantFormatter,
      cellClick: handleSideClick,
      sorter: participantSorter,
      responsive: false,
      title: 'Side 2',
      minWidth: 180,
      field: 'side2',
      widthGrow: 1,
    },
    {
      cellClick: handleScoreClick(replaceTableData, setFocusData),
      formatter: scoreFormatter,
      sorter: scoreSorter,
      field: 'scoreDetail',
      responsive: false,
      title: 'Score',
      width: 140,
    },
    {
      sorter: competitiveProfileSorter,
      formatter: profileFormatter,
      field: 'competitiveProfile',
      responsive: false,
      title: 'Profile',
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
      title: 'Status',
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
      cellClick: (e: Event, cell: any) => matchUpActions({ pointerEvent: e as PointerEvent, cell, ...cell.getData() }),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      widthGrow: 0,
      width: 50,
    },
  ];
}
