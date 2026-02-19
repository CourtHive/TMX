import { removeAllChildNodes } from 'services/dom/transformers';
import { createImagePanel, createNotesPanel, createStatCard, createSunburstPanel } from './dashboardPanels';
import { getDashboardData } from './dashboardData';

import { TOURNAMENT_OVERVIEW } from 'constants/tmxConstants';

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

  const data = getDashboardData();

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid; grid-template-columns:repeat(5, 1fr); gap:16px; padding:16px;';

  // Row 1: Image (2cols) + Notes (3cols)
  const imagePanel = createImagePanel(data.imageUrl);
  imagePanel.style.gridColumn = '1 / 3';
  grid.appendChild(imagePanel);

  const notesPanel = createNotesPanel(data.notes);
  notesPanel.style.gridColumn = '3 / 6';
  grid.appendChild(notesPanel);

  // Row 2+: Stats (2 left cols, 2-col sub-grid) + Sunburst (3 right cols)
  const statsContainer = document.createElement('div');
  statsContainer.style.cssText = 'grid-column:1/3; display:grid; grid-template-columns:1fr 1fr; gap:12px; align-content:start;';
  statsContainer.appendChild(createStatCard('Players', data.participantCount, 'fa-users'));
  statsContainer.appendChild(createStatCard('Events', data.eventCount, 'fa-trophy'));
  statsContainer.appendChild(createStatCard('MatchUps', data.matchUpStats.total, 'fa-table-tennis'));
  statsContainer.appendChild(createStatCard('Scheduled', data.matchUpStats.scheduled, 'fa-clock'));
  statsContainer.appendChild(createStatCard('Complete', `${data.matchUpStats.percentComplete}%`, 'fa-chart-pie'));
  statsContainer.appendChild(createStatCard('Dates', `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`, 'fa-calendar'));
  grid.appendChild(statsContainer);

  if (data.structures.length) {
    const sunburstPanel = createSunburstPanel(data.structures);
    sunburstPanel.style.gridColumn = '3 / 6';
    grid.appendChild(sunburstPanel);
  }

  element.appendChild(grid);
}
