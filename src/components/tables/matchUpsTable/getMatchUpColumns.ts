/**
 * Column definitions for matchUps table.
 * Displays match details, participants, scores, schedule, and completion status.
 */
import {
  scheduleDateFormatter,
  scheduleLockFormatter,
  scheduleTimeFormatter,
  calledAtFormatter,
} from '../common/formatters/scheduleStatusFormatter';
import { matchUpTypeChipFormatter } from '../common/formatters/matchUpTypeChipFormatter';
import { competitiveProfileSorter } from '../common/sorters/competitiveProfileSorter';
import { participantMatchUpActions } from '../../popovers/participantMatchUpActions';
import { participantProfileModal } from 'components/modals/participantProfileModal';
import { makeUpdatedAtFormatter } from '../common/formatters/updatedAtFormatter';
import { formatParticipant } from '../common/formatters/participantFormatter';
import { getScheduleDateRange } from 'pages/tournament/tabs/scheduleUtils';
import { resolveTimeSeed, validateTimeValue } from './scheduleTimeFields';
import { profileFormatter } from '../common/formatters/profileFormatter';
import { participantSorter } from '../common/sorters/participantSorter';
import { matchUpThreeDotsFormatter } from './matchUpThreeDotsFormatter';
import { eventFormatter } from '../common/formatters/eventsFormatter';
import { scoreFormatter } from '../common/formatters/scoreFormatter';
import { titleFormatter } from '../common/formatters/titleFormatter';
import { matchUpActions } from 'components/popovers/matchUpActions';
import { applyColumnVisibility } from '../common/columnIsVisible';
import { handleScoreClick } from './handleMatchUpScoreClick';
import { navigateToEvent } from '../common/navigateToEvent';
import { scoreSorter } from '../common/sorters/scoreSorter';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { setMatchUpSchedule } from './setMatchUpSchedule';
import { datePicker } from 'components/modals/datePicker';
import { timePicker } from 'components/modals/timePicker';
import { getCourtTimeBounds } from './courtTimeBounds';
import { headerMenu } from '../common/headerMenu';
import { tools } from 'tods-competition-factory';
import { context } from 'services/context';
import { highlightTab } from 'navigation';

// constants
import type { ScheduleTimeField, ScheduleTimes, TimeBounds } from './scheduleTimeFields';
import { CENTER, LEFT, RIGHT, SCHEDULING_TAB, TOURNAMENT } from 'constants/tmxConstants';
import { t } from 'i18n';

/**
 * Schedule time cells previously went straight from the picker to the mutation with no validation —
 * unlike the matchUp actions popover, which had checked ordering all along. That divergence let an
 * impossible end time reach the server, where it was rejected and, because `setMatchUpSchedule`
 * supplies a callback, silently discarded. Both paths now share `scheduleTimeFields`.
 */
function applyTimeSelection({
  field,
  time,
  row,
  data,
  schedule,
  bounds,
}: {
  field: ScheduleTimeField;
  time: string;
  row: any;
  data: any;
  schedule: ScheduleTimes;
  bounds: TimeBounds;
}): void {
  const value = tools.dateTime.convertTime(time, true) as string;

  // An empty value clears `scheduledTime`; start/end are not clearable from this cell (unchanged).
  if (!value && field !== 'scheduledTime') return;
  if (value === data[field]) return;

  const invalid = validateTimeValue({ field, value, schedule, bounds });
  if (invalid) {
    tmxToast({ message: invalid, intent: 'is-danger' });
    return;
  }

  setMatchUpSchedule({
    matchUpId: data.matchUpId,
    schedule: { [field]: value },
    callback: () => row.update({ ...data, [field]: value }),
  });
}

function timeCellClickHandler(field: ScheduleTimeField) {
  return (_e: Event, cell: any): void => {
    const row = cell.getRow();
    const data = row.getData();

    // Read the times off the row rather than `data.matchUp.schedule`: `row.update` keeps the flat
    // fields current after an edit, while the captured matchUp object does not.
    const schedule: ScheduleTimes = {
      scheduledTime: data.scheduledTime,
      startTime: data.startTime,
      endTime: data.endTime,
    };
    const bounds = getCourtTimeBounds(data.matchUp);

    timePicker({
      time: resolveTimeSeed({ field, schedule, bounds }),
      callback: ({ time }: { time: string }) => applyTimeSelection({ field, time, row, data, schedule, bounds }),
    });
  };
}

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
      const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
      const route = `/${TOURNAMENT}/${tournamentId}/${SCHEDULING_TAB}/${scheduledDate}`;
      context.router?.navigate(route);
      highlightTab(SCHEDULING_TAB);
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

  const matchUpTimeClick = timeCellClickHandler('scheduledTime');
  const matchUpStartTimeClick = timeCellClickHandler('startTime');
  const matchUpEndTimeClick = timeCellClickHandler('endTime');

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
      formatter: matchUpTypeChipFormatter,
      field: 'matchUpType',
      titleFormatter,
      title: t('tables.matchUps.type'),
      hozAlign: CENTER,
      width: 110,
    },
    {
      field: 'roundName',
      title: t('tables.matchUps.round'),
      titleFormatter,
      width: 100,
    },
    {
      cellClick: matchUpDateClick,
      formatter: scheduleDateFormatter,
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
      formatter: scheduleTimeFormatter,
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
      formatter: calledAtFormatter,
      field: 'calledAt',
      title: t('tables.matchUps.calledAt'),
      visible: false,
      width: 92,
    },
    {
      formatter: scheduleLockFormatter,
      field: 'scheduleLocked',
      title: t('tables.matchUps.scheduleLocked'),
      headerTooltip: t('schedule.lockedTip'),
      hozAlign: CENTER,
      visible: false,
      width: 70,
    },
    {
      formatter: matchUpParticipantFormatter,
      cellClick: handleSideClick,
      sorter: participantSorter,
      responsive: false,
      title: t('tables.matchUps.side1'),
      minWidth: 280,
      field: 'side1',
      widthGrow: 1,
    },
    {
      formatter: matchUpParticipantFormatter,
      cellClick: handleSideClick,
      sorter: participantSorter,
      responsive: false,
      title: t('tables.matchUps.side2'),
      minWidth: 280,
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
    (() => {
      // Resolve the tournament's canonical IANA zone (if set on the
      // record) once when columns are built. Falls back to the viewer's
      // local zone when no zone is stored. Re-opening the matchUps
      // view after editing the tournament's timezone rebuilds columns,
      // so the formatter closes over the fresh value.
      const localTimeZone = tournamentEngine.q.tournament()?.localTimeZone;
      return {
        title: t('tables.matchUps.updatedAt'),
        field: 'updatedAt',
        // Initially hidden — users enable via the header menu when they
        // need to audit freshness (cache-bust, stale-sync diagnosis, etc.).
        visible: false,
        width: 150,
        // Display `YYYY-MM-DD HH:MM` in the tournament zone (or local
        // fallback). Raw ISO stamp is attached to the cell title for
        // full-fidelity hover recoverability.
        formatter: makeUpdatedAtFormatter(localTimeZone),
        // Underlying cell value is still the raw ISO string, so
        // lexicographic sort is correct for ISO 8601 ordering.
        sorter: 'string',
      };
    })(),
    {
      cellClick: (e: Event, cell: any) => matchUpActions({ pointerEvent: e as PointerEvent, cell, ...cell.getData() }),
      formatter: matchUpThreeDotsFormatter,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      widthGrow: 0,
      width: 50,
    },
  ]);
}
