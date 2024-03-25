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

// constants
import { LEFT, RIGHT, SCHEDULE_TAB, TOURNAMENT } from 'constants/tmxConstants';

export function getMatchUpColumns({ data, replaceTableData, setFocusData }) {
  const matchUpScheduleClick = (e, cell) => {
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

  const matchUpTimeClick = (e, cell) => {
    const existingTime = cell.getValue();
    const timeSelected = ({ time }) => {
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
    timePicker({ time: existingTime, callback: timeSelected /*, options: { disabledTime: { hours: [11, 12] } }*/ });
  };

  const participantChange = () => replaceTableData();
  const showCourts = data.some((m) => m.courtName);

  const handleSideClick = (e, cell) => participantMatchUpActions(e, cell, participantChange);

  const matchUpParticipantFormatter = (cell) => {
    const placholder = document.createElement('div');
    placholder.className = 'has-text-warning-dark';
    placholder.innerHTML = 'Select participant';
    const onClick = ({ event, ...params }) => {
      participantMatchUpActions(event, cell, participantChange, params);
    };

    const value = cell.getValue();
    return value.participantName && formatParticipant(onClick)(cell, placholder);
  };

  return [
    {
      cellClick: (e, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5,
    },
    /*
    {
      formatter: 'responsiveCollapse',
      headerSort: false,
      resizable: false,
      hozAlign: CENTER,
      minWidth: 50,
      width: 50,
    },
    */
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
      // headerSort: false,
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
      cellClick: (e, cell) => matchUpActions({ pointerEvent: e, cell, ...cell.getData() }),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      widthGrow: 0,
      width: 50,
    },
  ];
}
