import { createImagePanel, createNotesPanel, createStatCard, createSunburstPanel } from './dashboardPanels';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'tods-competition-factory';
import { openEditDatesModal } from './editDatesModal';
import { getDashboardData } from './dashboardData';
import { context } from 'services/context';

// constants
import { EVENTS_TAB, MATCHUPS_TAB, PARTICIPANTS, SCHEDULE_TAB, TOURNAMENT, TOURNAMENT_OVERVIEW } from 'constants/tmxConstants';

function navigateToTab(tab: string): void {
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
  context.router.navigate(`/${TOURNAMENT}/${tournamentId}/${tab}`);
}

const STYLE_ID = 'dashboard-responsive-styles';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .dash-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      padding: 16px;
    }
    .dash-image   { grid-column: 1 / 3; }
    .dash-notes   { grid-column: 3 / 6; }
    .dash-stats   { grid-column: 1 / 3; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-content: start; }
    .dash-burst   { grid-column: 3 / 6; }

    .dash-panel {
      border-radius: 8px;
      padding: 16px;
      border-top: 4px solid;
    }
    .dash-panel-blue   { border-color: #4a90d9; background: #eef4fb; }
    .dash-panel-notes  { border-color: #333; background: transparent; }
    .dash-panel-green  { border-color: #48c774; background: #effaf3; }

    /* Tablet — stack to single column */
    @media (max-width: 900px) {
      .dash-grid   { grid-template-columns: 1fr; }
      .dash-image,
      .dash-notes,
      .dash-stats,
      .dash-burst  { grid-column: 1 / -1; }
      .dash-stats  { grid-template-columns: 1fr 1fr 1fr; }
    }

    /* Phone — stat cards go to 2-col */
    @media (max-width: 560px) {
      .dash-stats  { grid-template-columns: 1fr 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function renderOverview(): void {
  const element = document.getElementById(TOURNAMENT_OVERVIEW);
  if (!element) return;

  removeAllChildNodes(element);
  element.style.minHeight = '';
  ensureStyles();

  const data = getDashboardData();

  const grid = document.createElement('div');
  grid.className = 'dash-grid';

  // Row 1: Image (2cols) + Notes (3cols)
  const imagePanel = createImagePanel(data.imageUrl);
  imagePanel.className = 'dash-image';
  grid.appendChild(imagePanel);

  const notesPanel = createNotesPanel(data.notes);
  notesPanel.classList.add('dash-notes');
  grid.appendChild(notesPanel);

  // Row 2+: Stats (2 left cols) + Sunburst (3 right cols)
  const statsContainer = document.createElement('div');
  statsContainer.className = 'dash-stats';
  const datesCard = createStatCard(
    'Dates',
    `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`,
    'fa-calendar',
  );
  datesCard.style.cursor = 'pointer';
  datesCard.addEventListener('click', () => openEditDatesModal({ onSave: () => renderOverview() }));
  statsContainer.appendChild(datesCard);
  const eventsCard = createStatCard('Events', data.eventCount, 'fa-trophy');
  eventsCard.style.cursor = 'pointer';
  eventsCard.addEventListener('click', () => navigateToTab(EVENTS_TAB));
  statsContainer.appendChild(eventsCard);

  const playersCard = createStatCard('Players', data.participantCount, 'fa-users');
  playersCard.style.cursor = 'pointer';
  playersCard.addEventListener('click', () => navigateToTab(PARTICIPANTS));
  statsContainer.appendChild(playersCard);

  const matchUpsCard = createStatCard('MatchUps', data.matchUpStats.total, 'fa-table-tennis');
  matchUpsCard.style.cursor = 'pointer';
  matchUpsCard.addEventListener('click', () => navigateToTab(MATCHUPS_TAB));
  statsContainer.appendChild(matchUpsCard);

  const scheduledCard = createStatCard('Scheduled', data.matchUpStats.scheduled, 'fa-clock');
  scheduledCard.style.cursor = 'pointer';
  scheduledCard.addEventListener('click', () => navigateToTab(SCHEDULE_TAB));
  statsContainer.appendChild(scheduledCard);
  statsContainer.appendChild(createStatCard('Complete', `${data.matchUpStats.percentComplete}%`, 'fa-chart-pie'));
  grid.appendChild(statsContainer);

  if (data.structures.length) {
    const sunburstPanel = createSunburstPanel(data.structures);
    sunburstPanel.classList.add('dash-burst');
    grid.appendChild(sunburstPanel);
  }

  element.appendChild(grid);
}
