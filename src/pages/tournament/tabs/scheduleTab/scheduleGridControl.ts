/**
 * Schedule grid control bar with date navigation and search.
 * Provides date selection, search, team highlighting, and schedule activation toggle.
 */
import { competitionEngine, tools } from 'tods-competition-factory';
import { controlBar } from 'components/controlBar/controlBar';
import { context } from 'services/context';
import dayjs from 'dayjs';

import { LEFT, RIGHT, SCHEDULED_DATE_FILTER } from 'constants/tmxConstants';

type ScheduleGridControlParams = {
  toggleUnscheduled?: () => void;
  schedulingActive?: boolean;
  controlAnchor?: HTMLElement;
  scheduledDate?: string;
  courtsCount?: number;
};

export function scheduleGridControl({
  toggleUnscheduled,
  schedulingActive,
  controlAnchor,
  scheduledDate,
  courtsCount,
}: ScheduleGridControlParams = {}): { elements: any } {
  if (!controlAnchor) return { elements: undefined };

  let elements: any;

  const formatDate = (dateString: string) => dayjs(dateString).format('dddd MMM D');
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange();
  const dateRange = tools.generateDateRange(startDate, endDate);
  const dateOptions = dateRange.map((dateString: string) => ({
    onClick: () => {
      const tournamentId = competitionEngine.getTournamentInfo().tournamentInfo.tournamentId;
      context.router.navigate(`/tournament/${tournamentId}/schedule/${dateString}`);
    },
    isActive: dateString === scheduledDate,
    label: formatDate(dateString),
    value: dateString,
    close: true,
  }));

  const setSearchFilter = () => {};

  const items = [
    {
      clearSearch: () => setSearchFilter(),
      placeholder: 'Search participants',
      id: 'searchParticipants',
      visible: !!courtsCount,
      location: LEFT,
      search: true,
    },
    {
      options: [{ label: 'Team ', onClick: () => console.log('team clicked'), close: true }],
      label: 'Highlight team',
      visible: !!courtsCount,
      id: 'highlightTeam',
      location: LEFT,
      align: LEFT,
    },
    {
      visible: !!courtsCount && !schedulingActive,
      onClick: toggleUnscheduled,
      label: 'Schedule matches',
      id: 'scheduleMatchUps',
      intent: 'is-primary',
      location: RIGHT,
    },
    {
      label: formatDate(scheduledDate || startDate),
      value: scheduledDate || startDate,
      id: SCHEDULED_DATE_FILTER,
      options: dateOptions,
      modifyLabel: true,
      intent: 'is-info',
      location: RIGHT,
      align: RIGHT,
    },
  ];

  elements = controlBar({ target: controlAnchor, items })?.elements;

  return { elements };
}
