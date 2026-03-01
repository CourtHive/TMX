import { getLoginState } from 'services/authentication/loginState';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'tods-competition-factory';
import { openEditDatesModal } from './editDatesModal';
import { getDashboardData } from './dashboardData';
import { context } from 'services/context';
import { t } from 'i18n';
import {
  createActionsPanel,
  createDualStatCard,
  createTripleStatCard,
  createImagePanel,
  createNotesPanel,
  createStatCard,
  createSunburstPanel,
  createSunburstPlaceholder,
} from './dashboardPanels';

// constants
import {
  ADMIN,
  EVENTS_TAB,
  MATCHUPS_TAB,
  PARTICIPANTS,
  PUBLISHING_TAB,
  SUPER_ADMIN,
  TOURNAMENT,
  TOURNAMENT_OVERVIEW,
} from 'constants/tmxConstants';

function navigateToTab(tab: string): void {
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
  context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/${tab}`);
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
    .dash-stats   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-content: start; }
    .dash-burst   { grid-column: 3 / 6; }

    .dash-panel {
      border-radius: 8px;
      padding: 16px;
      border-top: 4px solid;
    }
    .dash-panel-blue   { border-color: var(--tmx-panel-blue-border); background: var(--tmx-panel-blue-bg); }
    .dash-panel-notes  { border-color: var(--tmx-text-primary); background: transparent; }
    .dash-panel-green  { border-color: var(--tmx-panel-green-border); background: var(--tmx-panel-green-bg); }
    .dash-panel-red    { border-color: var(--tmx-panel-red-border); background: var(--tmx-panel-red-bg); }
    .dash-panel-yellow { border-color: var(--tmx-panel-yellow-border); background: var(--tmx-panel-yellow-bg); }
    .dash-left   { grid-column: 1 / 3; display: flex; flex-direction: column; gap: 16px; }

    .dash-action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .dash-action-btn {
      padding: 6px 14px;
      border: 1px solid var(--tmx-panel-red-border);
      border-radius: 4px;
      background: var(--tmx-bg-primary);
      color: var(--tmx-text-primary);
      cursor: pointer;
      font-size: 0.85rem;
      transition: background 0.15s;
    }
    .dash-action-btn:hover {
      background: var(--tmx-panel-red-bg);
    }
    .dash-action-btn i {
      margin-right: 4px;
    }

    /* Tablet — stack to single column */
    @media (max-width: 900px) {
      .dash-grid   { grid-template-columns: 1fr; }
      .dash-image,
      .dash-notes,
      .dash-left,
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

  // Row 2+: Left column (stats + actions) + Sunburst (3 right cols)
  const leftColumn = document.createElement('div');
  leftColumn.className = 'dash-left';

  const statsContainer = document.createElement('div');
  statsContainer.className = 'dash-stats';
  const datesCard = createStatCard(
    t('dashboard.dates'),
    `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`,
    'fa-calendar',
  );
  datesCard.style.cursor = 'pointer';
  datesCard.addEventListener('click', () => openEditDatesModal({ onSave: () => renderOverview() }));
  statsContainer.appendChild(datesCard);
  const eventsCard = createDualStatCard([
    { label: t('dashboard.events'), value: data.eventCount, icon: 'fa-trophy' },
    { label: t('dashboard.draws'), value: data.drawDefinitionCount, icon: 'fa-sitemap' },
  ]);
  eventsCard.style.cursor = 'pointer';
  eventsCard.addEventListener('click', () => navigateToTab(EVENTS_TAB));
  statsContainer.appendChild(eventsCard);

  const playersCard = createDualStatCard([
    { label: t('dashboard.players'), value: data.participantCount, icon: 'fa-users' },
    { label: t('dashboard.teams'), value: data.teamParticipantCount, icon: 'fa-people-group' },
  ]);
  playersCard.style.cursor = 'pointer';
  playersCard.addEventListener('click', () => navigateToTab(PARTICIPANTS));
  statsContainer.appendChild(playersCard);

  const matchUpsCard = createTripleStatCard([
    { label: t('dashboard.matchUps'), value: data.matchUpStats.total, icon: 'fa-table-tennis' },
    { label: t('dashboard.scheduled'), value: data.matchUpStats.scheduled, icon: 'fa-clock' },
    { label: t('dashboard.complete'), value: `${data.matchUpStats.percentComplete}%`, icon: 'fa-chart-pie' },
  ]);
  matchUpsCard.style.cursor = 'pointer';
  matchUpsCard.addEventListener('click', () => navigateToTab(MATCHUPS_TAB));
  statsContainer.appendChild(matchUpsCard);

  const pubStats = data.publishingStats;
  const publishingCard = createDualStatCard([
    { label: t('dashboard.draws'), value: `${pubStats.publishedDraws}/${pubStats.totalDraws}`, icon: 'fa-eye' },
    { label: t('dashboard.embargoes'), value: pubStats.activeEmbargoes, icon: 'fa-clock' },
  ]);
  publishingCard.className = 'dash-panel dash-panel-yellow';
  publishingCard.style.cssText += 'grid-column: 1 / -1; cursor: pointer;';
  publishingCard.addEventListener('click', () => navigateToTab(PUBLISHING_TAB));

  const pubHeader = document.createElement('div');
  pubHeader.style.cssText =
    'display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:0.85rem; color:var(--tmx-text-secondary); margin-bottom:8px; width:100%;';
  const pubIcon = document.createElement('i');
  pubIcon.className = 'fa fa-eye';
  pubIcon.style.fontSize = '0.8rem';
  pubHeader.appendChild(pubIcon);
  pubHeader.appendChild(document.createTextNode(t('settings.publishing')));

  const lineBreak = document.createElement('div');
  lineBreak.style.cssText = 'flex-basis:100%; height:0;';
  pubHeader.appendChild(lineBreak);

  const oopBadge = document.createElement('span');
  oopBadge.style.cssText = 'font-size:0.75rem; padding:1px 6px; border-radius:3px;';
  if (pubStats.oopPublished) {
    oopBadge.textContent = t('publishing.oopLive');
    oopBadge.style.cssText += 'background:var(--tmx-accent-blue); color:var(--tmx-text-inverse);';
  } else {
    oopBadge.textContent = t('publishing.oopOff');
    oopBadge.style.cssText += 'background:var(--tmx-accent-red); color:var(--tmx-text-inverse);';
  }
  pubHeader.appendChild(oopBadge);

  const participantsBadge = document.createElement('span');
  participantsBadge.style.cssText = 'font-size:0.75rem; padding:1px 6px; border-radius:3px;';
  if (pubStats.participantsPublished) {
    participantsBadge.textContent = t('publishing.participantsLive');
    participantsBadge.style.cssText += 'background:var(--tmx-accent-blue); color:var(--tmx-text-inverse);';
  } else {
    participantsBadge.textContent = t('publishing.participantsOff');
    participantsBadge.style.cssText += 'background:var(--tmx-accent-red); color:var(--tmx-text-inverse);';
  }
  pubHeader.appendChild(participantsBadge);

  // Wrap the stat groups (Draws, Embargoes) so they share the right half of the panel
  const statGroups = Array.from(publishingCard.children);
  const statsWrapper = document.createElement('div');
  statsWrapper.style.cssText = 'display:flex; gap:16px; flex:1;';
  for (const child of statGroups) {
    (child as HTMLElement).style.flex = '1';
    statsWrapper.appendChild(child);
  }
  publishingCard.appendChild(statsWrapper);

  pubHeader.style.cssText += 'flex:1;';
  publishingCard.insertBefore(pubHeader, publishingCard.firstChild);
  statsContainer.appendChild(publishingCard);
  leftColumn.appendChild(statsContainer);

  const state = getLoginState();
  const isAdmin =
    state?.roles?.includes(SUPER_ADMIN) || (state?.roles?.includes(ADMIN) && state?.provider?.organisationId);
  if (isAdmin) {
    leftColumn.appendChild(createActionsPanel());
  }

  grid.appendChild(leftColumn);

  if (data.structures.length) {
    const sunburstPanel = createSunburstPanel(data.structures);
    sunburstPanel.classList.add('dash-burst');
    grid.appendChild(sunburstPanel);
  } else {
    const placeholder = createSunburstPlaceholder();
    placeholder.classList.add('dash-burst');
    grid.appendChild(placeholder);
  }

  element.appendChild(grid);
}
