import { competitionEngine, tools } from 'tods-competition-factory';
import { controlBar } from 'components/controlBar/controlBar';
import { context } from 'services/context';
import dayjs from 'dayjs';

import { LEFT, RIGHT, SCHEDULED_DATE_FILTER } from 'constants/tmxConstants';

export function scheduleGridControl({
  toggleUnscheduled,
  schedulingActive,
  controlAnchor,
  scheduledDate,
  courtsCount,
} = {}) {
  if (!controlAnchor) return;

  let elements; // for internal manipulation

  const formatDate = (dateString) => dayjs(dateString).format('dddd MMM D');
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange();
  const dateRange = tools.generateDateRange(startDate, endDate);
  const dateOptions = dateRange.map((dateString) => ({
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
      // onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateHighlights(''),
      // onChange: (e) => updateHighlights(e.target.value),
      // onKeyUp: (e) => updateHighlights(e.target.value),
      // clearSearch: () => updateHighlights(''),
      clearSearch: () => setSearchFilter(''),
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

  elements = controlBar({ target: controlAnchor, items }).elements;

  return { elements };
}
