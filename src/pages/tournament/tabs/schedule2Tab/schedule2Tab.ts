/**
 * Schedule 2 Tab — new schedule page shell with view switcher.
 *
 * Renders a persistent header (date strip + view switcher) and swaps between
 * Grid view (courthive-components createSchedulePage) and Profile view
 * (courthive-components createSchedulingProfile). A placeholder Live Courts
 * strip sits between the header and the active view.
 *
 * Routes:
 *   /#/tournament/:id/schedule2/:date          → Grid view (default)
 *   /#/tournament/:id/schedule2/:date/grid      → Grid view
 *   /#/tournament/:id/schedule2/:date/profile   → Profile view
 */
import { competitionEngine, tools } from 'tods-competition-factory';
import { context } from 'services/context';

import { SCHEDULE2_CONTAINER, SCHEDULE2_CONTROL, SCHEDULE2_TAB } from 'constants/tmxConstants';
import { buildSchedule2Header } from './schedule2Header';
import { renderGridView, destroyGridView } from './gridView';
import { renderProfileView, destroyProfileView } from './profileView';

export type Schedule2View = 'grid' | 'profile';

interface Schedule2State {
  currentView: Schedule2View;
  selectedDate: string;
}

let state: Schedule2State | null = null;

export function renderSchedule2Tab(params: { scheduledDate?: string; scheduleView?: string }): void {
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange();
  const now = new Date();
  const today = tools.dateTime.formatDate(now);
  const nowInRange = now >= new Date(startDate) && now <= new Date(endDate);
  const fallback = now > new Date(endDate) ? endDate : startDate;

  // Resolve date — redirect if missing
  if (!params.scheduledDate) {
    const scheduledDate = nowInRange ? today : fallback;
    const tournamentId = competitionEngine.getTournamentInfo().tournamentInfo?.tournamentId;
    context.router?.navigate(`/tournament/${tournamentId}/${SCHEDULE2_TAB}/${scheduledDate}`);
    return;
  }

  const scheduledDate = params.scheduledDate || (nowInRange ? today : fallback);
  const view: Schedule2View = params.scheduleView === 'profile' ? 'profile' : 'grid';

  // Store selected date for other parts of TMX
  context.displayed.selectedScheduleDate = scheduledDate;

  const controlAnchor = document.getElementById(SCHEDULE2_CONTROL)!;
  const container = document.getElementById(SCHEDULE2_CONTAINER)!;

  // Clear previous content
  controlAnchor.innerHTML = '';
  destroyCurrentView();
  container.innerHTML = '';

  state = { currentView: view, selectedDate: scheduledDate };

  // Build header with date strip + view switcher
  const header = buildSchedule2Header({
    selectedDate: scheduledDate,
    activeView: view,
    startDate,
    endDate,
    onDateChange: (date: string) => {
      const tournamentId = competitionEngine.getTournamentInfo().tournamentInfo?.tournamentId;
      context.router?.navigate(`/tournament/${tournamentId}/${SCHEDULE2_TAB}/${date}/${state?.currentView || 'grid'}`);
    },
    onViewChange: (newView: Schedule2View) => {
      const tournamentId = competitionEngine.getTournamentInfo().tournamentInfo?.tournamentId;
      context.router?.navigate(`/tournament/${tournamentId}/${SCHEDULE2_TAB}/${scheduledDate}/${newView}`);
    },
  });
  controlAnchor.appendChild(header);

  // Render the active view
  if (view === 'profile') {
    renderProfileView(container, scheduledDate);
  } else {
    renderGridView(container, scheduledDate);
  }
}

function destroyCurrentView(): void {
  if (!state) return;
  if (state.currentView === 'grid') destroyGridView();
  if (state.currentView === 'profile') destroyProfileView();
}
