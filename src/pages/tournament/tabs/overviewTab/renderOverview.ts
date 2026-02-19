import { createImagePanel, createNotesPanel, createStatCard, createSunburstPanel } from './dashboardPanels';
import { removeAllChildNodes } from 'services/dom/transformers';
import { openEditDatesModal } from './editDatesModal';
import { getDashboardData } from './dashboardData';

// constants
import { TOURNAMENT_OVERVIEW } from 'constants/tmxConstants';

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
  notesPanel.className = 'dash-notes';
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
  statsContainer.appendChild(createStatCard('Events', data.eventCount, 'fa-trophy'));
  statsContainer.appendChild(createStatCard('Players', data.participantCount, 'fa-users'));
  statsContainer.appendChild(createStatCard('MatchUps', data.matchUpStats.total, 'fa-table-tennis'));
  statsContainer.appendChild(createStatCard('Scheduled', data.matchUpStats.scheduled, 'fa-clock'));
  statsContainer.appendChild(createStatCard('Complete', `${data.matchUpStats.percentComplete}%`, 'fa-chart-pie'));
  grid.appendChild(statsContainer);

  if (data.structures.length) {
    const sunburstPanel = createSunburstPanel(data.structures);
    sunburstPanel.className = 'dash-burst';
    grid.appendChild(sunburstPanel);
  }

  element.appendChild(grid);
}
