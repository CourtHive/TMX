/**
 * Schedule grid control bar with date navigation and search.
 * Provides date selection, search, team highlighting, and schedule activation toggle.
 */
import { competitionEngine, tools } from 'tods-competition-factory';
import { controlBar } from 'courthive-components';
import { printSchedule } from 'components/modals/printSchedule';
import { context } from 'services/context';
import { env } from 'settings/env';
import { t } from 'i18n';
import dayjs from 'dayjs';

import { LEFT, RIGHT, SCHEDULED_DATE_FILTER } from 'constants/tmxConstants';

type ScheduleGridControlParams = {
  toggleUnscheduled?: () => void;
  schedulingActive?: boolean;
  controlAnchor?: HTMLElement;
  scheduledDate?: string;
  courtsCount?: number;
  table?: any;
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
      context.router?.navigate(`/tournament/${tournamentId}/schedule/${dateString}`);
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
      placeholder: t('pages.schedule.searchParticipants'),
      id: 'searchParticipants',
      visible: !!courtsCount,
      location: LEFT,
      search: true,
    },
    {
      options: [{ label: 'Team ', onClick: () => console.log('team clicked'), close: true }],
      label: t('pages.schedule.highlightTeam'),
      visible: !!courtsCount,
      id: 'highlightTeam',
      location: LEFT,
      align: LEFT,
    },
    {
      visible: !!courtsCount && env.pdfPrinting, // Only show if PDF printing beta feature is enabled
      onClick: () => {
        // Get schedule data from competitionEngine with grid rows
        const matchUpFilters = { localPerspective: true, scheduledDate };
        const result = competitionEngine.competitionScheduleMatchUps({
          courtCompletedMatchUps: true,
          withCourtGridRows: true,
          minCourtGridRows: 10,
          nextMatchUps: true, // Include potentialParticipants for upcoming matches
          matchUpFilters,
        });
        
        const { courtsData = [], rows = [] } = result;
        

        
        printSchedule({
          scheduledDate: scheduledDate || startDate,
          courts: courtsData,
          rows,
        });
      },
      label: t('pages.schedule.print'),
      id: 'printSchedule',
      intent: 'is-info',
      location: RIGHT,
    },
    {
      visible: !!courtsCount && !schedulingActive,
      onClick: toggleUnscheduled,
      label: t('pages.schedule.scheduleMatches'),
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
