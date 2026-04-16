/**
 * Column definitions for matchUps table.
 * Displays match details, participants, scores, schedule, and completion status.
 */
import { participantProfileModal } from 'components/modals/participantProfileModal';
import { participantMatchUpActions } from '../../popovers/participantMatchUpActions';
import { competitiveProfileSorter } from '../common/sorters/competitiveProfileSorter';
import { formatParticipant } from '../common/formatters/participantFormatter';
import { getScheduleDateRange } from 'pages/tournament/tabs/scheduleUtils';
import { participantSorter } from '../common/sorters/participantSorter';
import { profileFormatter } from '../common/formatters/profileFormatter';
import { eventFormatter } from '../common/formatters/eventsFormatter';
import { scoreFormatter } from '../common/formatters/scoreFormatter';
import { titleFormatter } from '../common/formatters/titleFormatter';
import { matchUpActions } from 'components/popovers/matchUpActions';
import { tournamentEngine, tools } from 'tods-competition-factory';
import { handleScoreClick } from './handleMatchUpScoreClick';
import { applyColumnVisibility } from '../common/columnIsVisible';
import { navigateToEvent } from '../common/navigateToEvent';
import { scoreSorter } from '../common/sorters/scoreSorter';
import { threeDots } from '../common/formatters/threeDots';
import { setMatchUpSchedule } from './setMatchUpSchedule';
import { datePicker } from 'components/modals/datePicker';
import { timePicker } from 'components/modals/timePicker';
import { headerMenu } from '../common/headerMenu';
import { context } from 'services/context';
import { highlightTab } from 'navigation';

// constants
import { CENTER, LEFT, RIGHT, SCHEDULE_TAB, TOURNAMENT } from 'constants/tmxConstants';
import { t } from 'i18n';

export function getMatchUpColumns({
  data,
  replaceTableData,
  setFocusData,
}: {
  data: any[];
  replaceTableData: () => void;
  setFocusData?: (data: any) => void;
}): any[] {
  const matchUpScheduleClick = (_e: Event, cell: any) => {
    const row = cell.getRow();
    const data = row.getData();
    const { courtName, scheduledDate } = data;
    if (courtName && scheduledDate) {
      const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
      const route = `/${TOURNAMENT}/${tournamentId}/${SCHEDULE_TAB}/${scheduledDate}`;
      context.router?.navigate(route);
      highlightTab(SCHEDULE_TAB);
    }
  };

  const matchUpDateClick = (_e: Event, cell: any) => {
    const existingDate = cell.getValue();
    const activeDates = getScheduleDateRange();
    const row = cell.getRow();
    const data = row.getData();
    const { matchUpId } = data;

    datePicker({
      date: existingDate,
      activeDates,
      callback: ({ date }) => {
        if (date && date !== existingDate) {
          setMatchUpSchedule({
            matchUpId,
            schedule: { scheduledDate: date },
            callback: () => row.update({ ...data, scheduledDate: date }),
          });
        }
      },
    });
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
        const callback = () => row.update({ ...data, scheduledTime });
        setMatchUpSchedule({ matchUpId, schedule: { scheduledTime }, callback });
      }
    };
    timePicker({ time: existingTime, callback: timeSelected });
  };

  const matchUpStartTimeClick = (_e: Event, cell: any) => {
    const existingTime = cell.getValue();
    const timeSelected = ({ time }: { time: string }) => {
      const startTime = tools.dateTime.convertTime(time, true) as string;
      const row = cell.getRow();
      const data = row.getData();
      const { matchUpId } = data;
      if (startTime && startTime !== existingTime) {
        setMatchUpSchedule({
          matchUpId,
          schedule: { startTime },
          callback: () => row.update({ ...data, startTime }),
        });
      }
    };
    timePicker({ time: existingTime, callback: timeSelected });
  };

  const matchUpEndTimeClick = (_e: Event, cell: any) => {
    const existingTime = cell.getValue();
    const timeSelected = ({ time }: { time: string }) => {
      const endTime = tools.dateTime.convertTime(time, true) as string;
      const row = cell.getRow();
      const data = row.getData();
      const { matchUpId } = data;
      if (endTime && endTime !== existingTime) {
        setMatchUpSchedule({
          matchUpId,
          schedule: { endTime },
          callback: () => row.update({ ...data, endTime }),
        });
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
    const onClick = (params: any) => {
      const clickedParticipant = params?.individualParticipant || params?.participant;
      const rowData = cell.getRow().getData();
      const matchUpType = rowData.matchUpType;
      if (matchUpType === 'TEAM') return;
      const participantId = clickedParticipant?.participantId;
      if (!participantId) return;
      const matchUp = rowData.matchUp;
      const participantIds: string[] = [];
      for (const side of matchUp?.sides || []) {
        if (side?.participant?.participantId) {
          participantIds.push(side.participant.participantId);
        }
        for (const ip of side?.participant?.individualParticipants || []) {
          if (ip.participantId) participantIds.push(ip.participantId);
        }
      }
      participantProfileModal({
        participantId,
        participantIds: participantIds.length > 1 ? participantIds : undefined,
        readOnly: true,
      });
    };

    const value = cell.getValue();
    return value.participantName && (formatParticipant(onClick) as any)(cell, placholder);
  };

  return applyColumnVisibility([
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
        startTime: 'Start time',
        endTime: 'End time',
        official: 'Official',
        duration: 'Duration',
        complete: 'Complete',
      }),
      formatter: 'rownum',
      headerSort: false,
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      width: 65,
    },
    {
      formatter: eventFormatter(navigateToEvent),
      field: 'eventId',
      title: t('tables.matchUps.event'),
      visible: true,
      minWidth: 200,
      widthGrow: 1,
    },
    {
      title: t('tables.matchUps.flight'),
      visible: false,
      minWidth: 150,
      field: 'flight',
      widthGrow: 1,
    },
    {
      field: 'matchUpType',
      titleFormatter,
      title: t('tables.matchUps.type'),
      minWidth: 90,
    },
    {
      field: 'roundName',
      title: t('tables.matchUps.round'),
      titleFormatter,
      minWidth: 90,
    },
    {
      cellClick: matchUpDateClick,
      field: 'scheduledDate',
      title: t('tables.matchUps.date'),
      width: 110,
    },
    {
      cellClick: matchUpScheduleClick,
      visible: !!showCourts,
      field: 'courtName',
      title: t('tables.matchUps.court'),
      width: 100,
    },
    {
      cellClick: matchUpTimeClick,
      field: 'scheduledTime',
      visible: true,
      title: t('tables.matchUps.time'),
      width: 70,
    },
    {
      cellClick: matchUpStartTimeClick,
      field: 'startTime',
      title: t('tables.matchUps.startTime'),
      visible: false,
      width: 80,
    },
    {
      cellClick: matchUpEndTimeClick,
      field: 'endTime',
      title: t('tables.matchUps.endTime'),
      visible: false,
      width: 80,
    },
    {
      formatter: matchUpParticipantFormatter,
      cellClick: handleSideClick,
      sorter: participantSorter,
      responsive: false,
      title: t('tables.matchUps.side1'),
      minWidth: 180,
      field: 'side1',
      widthGrow: 1,
    },
    {
      formatter: matchUpParticipantFormatter,
      cellClick: handleSideClick,
      sorter: participantSorter,
      responsive: false,
      title: t('tables.matchUps.side2'),
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
      title: t('tables.matchUps.score'),
      width: 140,
    },
    {
      sorter: competitiveProfileSorter,
      formatter: profileFormatter,
      field: 'competitiveProfile',
      responsive: false,
      title: t('tables.matchUps.profile'),
      visible: false,
      width: 140,
    },
    {
      title: `<div class='fa-solid fa-check' style='color: var(--tmx-accent-green)' />`,
      formatter: 'tickCross',
      field: 'complete',
      hozAlign: LEFT,
      tooltip: false,
      width: 40,
    },
    {
      field: 'official',
      title: t('tables.matchUps.official'),
      visible: false,
      width: 140,
    },
    {
      field: 'matchUp.matchUpStatus',
      title: t('tables.matchUps.status'),
      width: 150,
    },
    {
      title: `<div class='fa-solid fa-clock' style='color: var(--tmx-accent-blue)' />`,
      headerSort: false,
      field: 'duration',
      visible: false,
      width: 70,
    },
    {
      title: t('tables.matchUps.updatedAt'),
      field: 'updatedAt',
      // Initially hidden — users enable via the header menu when they
      // need to audit freshness (cache-bust, stale-sync diagnosis, etc.).
      visible: false,
      width: 150,
      // Local-time HH:MM:SS display with full ISO string tooltip so the
      // raw timestamp is always recoverable on hover.
      formatter: (cell: any) => {
        const value = cell.getValue();
        if (!value || typeof value !== 'string') return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        const now = new Date();
        const sameDay =
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate();
        const hh = d.getHours().toString().padStart(2, '0');
        const mm = d.getMinutes().toString().padStart(2, '0');
        const ss = d.getSeconds().toString().padStart(2, '0');
        const display = sameDay
          ? `${hh}:${mm}:${ss}`
          : `${d.toLocaleDateString()} ${hh}:${mm}:${ss}`;
        cell.getElement().setAttribute('title', value);
        return display;
      },
      // Lexicographic compare works correctly on ISO 8601 UTC strings.
      sorter: 'string',
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
  ]);
}
