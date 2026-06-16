import { isActiveProviderAdmin } from 'services/authentication/isProviderAdmin';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'services/factory/engine';
import { openCategoriesEditorModal } from './categoriesEditorModal';
import { openPracticeCapacityModal } from './practiceCapacityModal';
import { resolveCurrentPracticeDefaultCapacity } from './practiceCapacityModal.logic';
import { openEditDatesModal } from './editDatesModal';
import { getDetectedTimeZone } from 'functions/getDetectedTimeZone';
import { getDashboardData } from './dashboardData';
import { context } from 'services/context';
import { t } from 'i18n';
import {
  buildScalingsChart,
  collectAvailableScales,
  MAX_PARTICIPANTS_FOR_OVERVIEW,
} from 'components/charts/participantScalings';
import {
  createActionsPanel,
  createDualStatCard,
  createTripleStatCard,
  createImagePanel,
  createNotesPanel,
  createStatCard,
  createSunburstPanel,
  createSunburstPlaceholder,
  shouldShowFormatWizard,
} from './dashboardPanels';

// constants
import {
  EVENTS_TAB,
  FORMAT_WIZARD_LAUNCHER,
  MATCHUPS_TAB,
  PARTICIPANTS,
  PUBLISHING_TAB,
  TOURNAMENT,
  TOURNAMENT_OVERVIEW,
} from 'constants/tmxConstants';

function navigateToTab(tab: string): void {
  const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
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
  const isoLike = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T00:00:00` : dateStr;
  const d = new Date(isoLike);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function renderOverview(): void {
  const element = document.getElementById(TOURNAMENT_OVERVIEW);
  if (!element) return;

  // Wire the remote-mutation refresh hook so the dashboard stats stay in sync
  // when other clients mutate the tournament — same pattern as schedule2 grid
  // and matchUps. renderOverview() is idempotent and rebuilds from current
  // factory state, so it's safe to call as the refresh.
  context.refreshActiveTable = renderOverview;

  removeAllChildNodes(element);
  element.style.minHeight = '';
  ensureStyles();

  const data = getDashboardData();

  const grid = document.createElement('div');
  grid.className = 'dash-grid';

  // Row 1: Image (2cols) + Notes (3cols)
  const imagePanel = createImagePanel(data.imageUrl, data.courtSvgSport);
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

  // Tournament Dates panel — full width above the 2-col stats grid so
  // long ranges ("May 7, 2026 – May 23, 2026") aren't truncated by the
  // narrow stat-card column. The tournament's local timezone — when set
  // — is surfaced right-justified on the label row so TDs can see (and
  // edit, via the click-through modal) the zone that drives every "Live"
  // / "Completed" / scheduled-time calculation downstream. When it's NOT
  // set, surface a muted "Set time zone" prompt — and if the browser can
  // tell us where the TD is, include the detected zone so the modal can
  // pre-fill it as a one-click confirmation.
  const tournamentRecord = tournamentEngine.q.tournament();
  const localTimeZone = tournamentRecord?.localTimeZone;
  const detectedTimeZone = localTimeZone ? null : getDetectedTimeZone();
  let datesRightLabel: string | undefined;
  let datesRightIsPlaceholder = false;
  if (localTimeZone) {
    datesRightLabel = localTimeZone;
  } else if (detectedTimeZone) {
    datesRightLabel = t('dashboard.setTimeZoneDetected', { zone: detectedTimeZone });
    datesRightIsPlaceholder = true;
  } else {
    datesRightLabel = t('dashboard.setTimeZone');
    datesRightIsPlaceholder = true;
  }
  const datesCard = createStatCard(
    t('dashboard.dates'),
    `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`,
    'fa-calendar',
    datesRightLabel,
    datesRightIsPlaceholder,
  );
  datesCard.style.cursor = 'pointer';
  datesCard.style.cssText += 'grid-column: 1 / -1;';
  datesCard.addEventListener('click', () => openEditDatesModal({ onSave: () => renderOverview() }));
  statsContainer.appendChild(datesCard);

  // Categories card — opens the categories editor. Takes the slot the
  // dates card used to occupy in the 2-col grid.
  const categories = tournamentEngine.q.tournament()?.tournamentCategories ?? [];
  const categoriesValue =
    categories.length === 0
      ? t('dashboard.noneSet')
      : categories
          .slice(0, 3)
          .map((c: any) => c.categoryName)
          .filter(Boolean)
          .join(', ') + (categories.length > 3 ? ` +${categories.length - 3}` : '');
  const categoriesCard = createStatCard(
    t('dashboard.categories', { count: categories.length }),
    categoriesValue,
    'fa-layer-group',
  );
  categoriesCard.style.cursor = 'pointer';
  categoriesCard.addEventListener('click', () => openCategoriesEditorModal({ onSave: () => renderOverview() }));
  statsContainer.appendChild(categoriesCard);

  // Practice default-capacity card — small admin affordance for the
  // tournament-wide PRACTICE booking capacity default. Doesn't reorganise
  // the grid; lives between categories and events as another clickable
  // stat card. Value reads as "Unlimited" when null/absent, "Closed" for 0.
  const currentCapacity = resolveCurrentPracticeDefaultCapacity();
  const capacityValue =
    currentCapacity === null
      ? t('dashboard.practiceUnlimited')
      : currentCapacity === 0
        ? t('dashboard.practiceClosed')
        : String(currentCapacity);
  const practiceCapacityCard = createStatCard(t('dashboard.practiceCapacity'), capacityValue, 'fa-people-roof');
  practiceCapacityCard.style.cursor = 'pointer';
  practiceCapacityCard.addEventListener('click', () => openPracticeCapacityModal({ onSave: () => renderOverview() }));
  statsContainer.appendChild(practiceCapacityCard);

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

  // Fetch participants once with scale values — the scalings histogram
  // needs the rating-value enriched array, and the wizard-visibility
  // check only reads `.length`, so the same call serves both. The plain
  // (non-withScaleValues) call that lived inside shouldShowFormatWizard
  // was a second pass over the same underlying data.
  const participantsWithScales =
    tournamentEngine.getParticipants({ withScaleValues: true })?.participants ?? [];

  // Scalings histogram — full-width panel above the publishing card.
  // Gated on participant count to avoid pulling + binning thousands of
  // rating values on the dashboard render path. Hidden silently when
  // no participants carry numeric scale values.
  appendScalingsPanel(statsContainer, participantsWithScales);

  statsContainer.appendChild(publishingCard);
  leftColumn.appendChild(statsContainer);

  const isAdmin = isActiveProviderAdmin();

  // Format Wizard launcher — NOT admin-gated. Visible whenever the
  // wizard's visibility conditions are met (no events, or
  // participants without entries). This is the entry point for demo
  // mode where there's no logged-in user.
  const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
  if (tournamentId && shouldShowFormatWizard(participantsWithScales, data.events)) {
    leftColumn.appendChild(createFormatWizardLauncher(tournamentId));
  }

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

function createFormatWizardLauncher(tournamentId: string): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'dash-panel';
  panel.style.cssText =
    'display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--tmx-accent-teal, #00b8a9); background: var(--tmx-bg-primary, #fff); border-radius: 6px; margin-top: 12px;';

  const icon = document.createElement('i');
  icon.className = 'fa fa-magic';
  icon.style.cssText = 'color: var(--tmx-accent-teal, #00b8a9); font-size: 20px;';
  panel.appendChild(icon);

  const text = document.createElement('div');
  text.style.cssText = 'flex: 1;';
  text.innerHTML = `
    <div style="font-weight: 600; font-size: 14px; color: var(--tmx-text-primary, #222);">${t('formatWizard.title')}</div>
    <div style="font-size: 12px; color: var(--tmx-text-secondary, #777);">${t('formatWizard.launcherSubtitle')}</div>
  `;
  panel.appendChild(text);

  const button = document.createElement('button');
  button.id = FORMAT_WIZARD_LAUNCHER;
  button.type = 'button';
  button.style.cssText =
    'background: var(--tmx-accent-teal, #00b8a9); color: #fff; border: none; border-radius: 4px; padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer;';
  button.textContent = t('formatWizard.launch');
  button.addEventListener('click', () => {
    context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/format-wizard`);
  });
  panel.appendChild(button);

  return panel;
}

/**
 * Append a full-width scalings histogram card to the dashboard stats
 * grid. No-op when the tournament has too many participants for an
 * instant render or when no participant carries a numeric scale value.
 */
function appendScalingsPanel(statsContainer: HTMLElement, participants: any[]): void {
  if (!Array.isArray(participants) || participants.length === 0) return;
  if (participants.length > MAX_PARTICIPANTS_FOR_OVERVIEW) return;

  const scales = collectAvailableScales(participants);
  if (scales.length === 0) return;

  const card = document.createElement('div');
  card.className = 'dash-panel dash-panel-yellow';
  card.style.cssText = 'grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px;';

  const header = document.createElement('div');
  header.style.cssText =
    'display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.85rem; color: var(--tmx-text-secondary);';

  const title = document.createElement('div');
  title.style.cssText = 'display: flex; align-items: center; gap: 6px;';
  const titleIcon = document.createElement('i');
  titleIcon.className = 'fa fa-chart-column';
  titleIcon.style.fontSize = '0.8rem';
  title.appendChild(titleIcon);
  title.appendChild(document.createTextNode('Scalings'));
  header.appendChild(title);

  const { element: chartElement } = buildScalingsChart(scales, { variant: 'full' });
  // The selector lives inside the chart element. Move it up into the
  // header so the title and the scale selector share a row. The chart
  // module appends [chart, select] so the selector is the LAST child.
  const selectorEl = chartElement.querySelector(':scope > select') as HTMLElement | null;
  if (selectorEl) header.appendChild(selectorEl);

  card.appendChild(header);
  card.appendChild(chartElement);
  statsContainer.appendChild(card);
}
