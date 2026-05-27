/**
 * Render events tab with 3-zone layout:
 * 1. Compact event selector (or full events table when no event selected)
 * 2. Event tabs bar (Draws / Entries / Rankings)
 * 3. Tab content (draw view, entries panels, points table, or add-draw placeholder)
 */
import { createUnifiedEntriesPanel } from 'components/tables/eventsTable/unified/createUnifiedEntriesPanel';
import { createBracketTable } from 'components/tables/bracketTable/createBracketTable';
import { createPointsTable } from 'components/tables/pointsTable/createPointsTable';
import { createRoundsTable } from 'components/tables/roundsTable/createRoundsTable';
import { createStatsTable } from 'components/tables/statsTable/createStatsTable';
import { renderEventTabsBar, renderNoDrawsPlaceholder } from './eventTabsBar';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { setEventView } from 'components/tables/eventsTable/setEventView';
import { renderEventSelector, hideEventSelector } from './eventSelector';
import { addFlights } from 'components/modals/addFlights/addFlights';
import { renderDrawsTable } from './renderDraws/renderDrawsTable';
import { renderDrawsGrid, readEventDrawsAvailability } from './renderDraws/renderDrawsGrid';
import { readDrawsViewMode, writeDrawsViewMode } from './renderDraws/drawsViewMode';
import { readDrawCardDisplayMode, writeDrawCardDisplayMode } from './renderDraws/drawCardDisplayMode';
import type { DrawCardDisplayMode } from './renderDraws/drawCardDisplayMode';
import type { VizDataAvailability } from './renderDraws/drawCardVizGating';
import { openDisplayOptionsPopover } from './renderDraws/displayOptionsPopover';
import { buildViewToggleElement } from 'components/tables/common/viewToggle';
import { deleteFlights } from 'components/modals/deleteFlights';
import { destroyTables } from 'pages/tournament/destroyTable';
import { renderDrawView } from './renderDraws/renderDrawView';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { tmxToast } from 'services/notifications/tmxToast';
import { cleanupDrawPanel } from './cleanupDrawPanel';
import { renderDrawPanel } from './renderDrawPanel';
import { highlightTab } from 'navigation';
import { eventsView } from './eventsView';

// constants
import { tournamentEngine } from 'services/factory/engine';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { controlBar } from 'courthive-components';
import {
  DRAWS_HEADER,
  DRAWS_VIEW,
  EVENTS_TAB,
  EVENT_CONTROL,
  EVENT_INFO,
  EVENT_TABS_BAR,
  OVERLAY,
  RIGHT,
  ROUNDS_BRACKET,
  ROUNDS_COLUMNS,
  ROUNDS_STATS,
  ROUNDS_TABLE,
} from 'constants/tmxConstants';

const { CONTAINER } = drawDefinitionConstants;

type RenderEventsTabParams = {
  eventId?: string;
  drawId?: string;
  structureId?: string;
  renderDraw?: boolean;
  renderPoints?: boolean;
  roundsView?: string;
};

export function renderEventsTab(params: RenderEventsTabParams): void {
  let { eventId, drawId, structureId, renderDraw, renderPoints, roundsView } = params;

  // Resolve structureId from draw data when not provided; default to Grid view for round robin draws
  if (drawId) {
    const eventData = tournamentEngine.getEventData({ eventId })?.eventData;
    const drawData = eventData?.drawsData?.find((d: any) => d.drawId === drawId);
    if (!structureId) structureId = drawData?.structures?.[0]?.structureId;
    if (!roundsView) {
      const struct = drawData?.structures?.find((s: any) => s.structureId === structureId);
      roundsView = struct?.structureType === CONTAINER ? ROUNDS_BRACKET : ROUNDS_COLUMNS;
    }
  }
  highlightTab(EVENTS_TAB);
  destroyTables();
  cleanupDrawPanel();

  const showEvent = eventId || drawId;

  if (!showEvent || !eventId) {
    // No event selected — full events table
    hideEventSelector();
    const tabsBar = document.getElementById(EVENT_TABS_BAR);
    if (tabsBar) tabsBar.style.display = 'none';
    eventsView();
    setEventView({ eventId });
    return;
  }

  // Event selected — show compact selector
  renderEventSelector({ eventId });

  if (renderPoints) {
    const { policyControlsElement } = createPointsTable({ eventId });
    renderEventTabsBar({ eventId, drawId, activeTab: 'points', rightContent: policyControlsElement });
    setEventView({ renderPoints });
  } else if (renderDraw) {
    renderDrawTab(eventId, drawId, structureId, renderDraw, roundsView);
  } else {
    renderEntriesTab(eventId, drawId);
  }
}

function renderDrawTab(
  eventId: string,
  drawId: string | undefined,
  structureId: string | undefined,
  renderDraw: boolean | undefined,
  roundsView: string | undefined,
): void {
  renderEventTabsBar({ eventId, drawId, activeTab: 'draws' });
  if (drawId) {
    const result = renderDrawPanel({ eventId, drawId });
    if (result.success) {
      if (roundsView === ROUNDS_TABLE) {
        (createRoundsTable as any)({ eventId, drawId, structureId, roundsView });
      } else if (roundsView === ROUNDS_STATS) {
        (createStatsTable as any)({ eventId, drawId, structureId, roundsView });
      } else if (roundsView === ROUNDS_BRACKET) {
        (createBracketTable as any)({ eventId, drawId, structureId, roundsView });
      } else {
        (renderDrawView as any)({ eventId, drawId, structureId, redraw: true, roundsView });
      }
      setEventView({ renderDraw });
    } else {
      createUnifiedEntriesPanel({ eventId, drawId });
      setEventView({ eventId });
    }
  } else {
    renderDrawsListOrPlaceholder(eventId, renderDraw);
  }
}

function renderDrawsListOrPlaceholder(eventId: string, renderDraw: boolean | undefined): void {
  const event = tournamentEngine.getEvent({ eventId })?.event;
  const drawDefs = event?.drawDefinitions || [];

  const flightProfile = tournamentEngine.getFlightProfile({ event })?.flightProfile;
  const ungeneratedCount =
    flightProfile?.flights?.filter((f: any) => !drawDefs.some((dd: any) => dd.drawId === f.drawId))?.length || 0;
  const totalDrawItems = drawDefs.length + ungeneratedCount;

  if (totalDrawItems > 0) {
    renderDrawsTableView(eventId, event, renderDraw);
  } else {
    renderNoDrawsView(eventId, renderDraw);
  }
}

function buildDisplayOptionsButton({
  current,
  drawCount,
  availability,
  onChange,
}: {
  current: DrawCardDisplayMode;
  drawCount: number;
  availability: VizDataAvailability;
  onChange: (next: DrawCardDisplayMode) => void;
}): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button is-light font-medium';
  button.style.cssText = 'padding: 0.3em 0.6em; line-height: 1;';
  button.setAttribute('aria-label', 'Card display options');
  button.innerHTML = '<i class="fa-solid fa-palette"></i>';
  button.addEventListener('click', () => {
    openDisplayOptionsPopover({ anchor: button, current, drawCount, availability, onChange });
  });
  return button;
}

function renderDrawsHeader({
  count,
  mode,
  onModeChange,
  displayMode,
  availability,
  onDisplayModeChange,
}: {
  count: number;
  mode: 'grid' | 'table';
  onModeChange: (next: 'grid' | 'table') => void;
  displayMode: DrawCardDisplayMode;
  availability: VizDataAvailability;
  onDisplayModeChange: (next: DrawCardDisplayMode) => void;
}): void {
  const headerEl = document.getElementById(DRAWS_HEADER);
  if (!headerEl) return;
  headerEl.style.display = '';
  while (headerEl.firstChild) headerEl.removeChild(headerEl.firstChild);

  const title = document.createElement('span');
  title.textContent = `Draws (${count})`;
  headerEl.appendChild(title);

  const trailing = document.createElement('div');
  trailing.style.cssText = 'display:flex; align-items:center; gap:0.4rem;';
  if (mode === 'grid') {
    trailing.appendChild(
      buildDisplayOptionsButton({ current: displayMode, drawCount: count, availability, onChange: onDisplayModeChange }),
    );
  }
  trailing.appendChild(buildViewToggleElement({ mode, onChange: onModeChange }));
  headerEl.appendChild(trailing);
}

function renderDrawsTableView(eventId: string, _event: any, renderDraw: boolean | undefined): void {
  renderEventTabsBar({ eventId, activeTab: 'draws' });
  setEventView({ renderDraw });
  const contentEl = document.getElementById(DRAWS_VIEW);
  if (!contentEl) return;

  let mode = readDrawsViewMode();
  let displayMode = readDrawCardDisplayMode();
  let drawsTable: any;
  let drawCount = 0;
  let availability: VizDataAvailability = { hasRatings: false, hasCompetitiveness: false };

  const drawAdded = (result: any) => {
    if (result.success) {
      navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
    }
  };

  const deleteSelectedDraws = () => {
    if (!drawsTable) return;
    const selectedDraws = drawsTable.getSelectedData();
    const drawIds = selectedDraws.map(({ drawId }: any) => drawId);
    drawsTable.deselectRow();
    const callback = (result: any) => {
      if (!result.success) {
        if (result.error?.message) tmxToast({ message: result.error.message, intent: 'is-danger' });
        return;
      }
      drawsTable.deleteRow(drawIds);
      if (drawsTable.getDataCount() === 0) {
        navigateToEvent({ eventId, renderDraw: true });
      }
    };
    deleteFlights({ eventId, drawIds, callback });
  };

  function renderForMode(): void {
    contentEl!.innerHTML = '';
    drawsTable = undefined;
    if (mode === 'grid') {
      const result = renderDrawsGrid({ eventId, target: contentEl!, displayMode });
      drawCount = result.count;
      availability = result.availability;
    } else {
      drawsTable = renderDrawsTable({ eventId, target: contentEl! });
      drawCount = drawsTable?.getDataCount?.() ?? 0;
      availability = readEventDrawsAvailability(eventId);
    }
    renderDrawsHeader({
      count: drawCount,
      mode,
      onModeChange: (next) => {
        if (next === mode) return;
        mode = next;
        writeDrawsViewMode(next);
        renderForMode();
      },
      displayMode,
      availability,
      onDisplayModeChange: (next) => {
        if (next === displayMode) return;
        displayMode = next;
        writeDrawCardDisplayMode(next);
        renderForMode();
      },
    });
    renderControls();
  }

  function renderControls(): void {
    const controlTarget = document.getElementById(EVENT_CONTROL) || undefined;
    if (!controlTarget) return;
    controlTarget.innerHTML = '';
    controlBar({
      table: drawsTable,
      target: controlTarget,
      items: [
        {
          onClick: deleteSelectedDraws,
          label: 'Delete selected',
          intent: 'is-danger',
          stateChange: true,
          hide: mode === 'grid',
          location: OVERLAY,
        },
        {
          onClick: () =>
            addFlights({ eventId, callback: () => navigateToEvent({ eventId, renderDraw: true }) }),
          intent: 'is-info',
          label: 'Add flights',
          location: RIGHT,
        },
        {
          onClick: () => addDraw({ eventId, callback: drawAdded }),
          intent: 'is-primary',
          label: 'Add draw',
          location: RIGHT,
        },
      ],
    });
  }

  renderForMode();
}

function renderNoDrawsView(eventId: string, renderDraw: boolean | undefined): void {
  renderEventTabsBar({ eventId, activeTab: 'draws' });
  setEventView({ renderDraw });
  const eventInfo = document.getElementById(EVENT_INFO);
  if (eventInfo) eventInfo.style.display = 'none';
  const contentEl = document.getElementById(DRAWS_VIEW);
  if (contentEl) {
    contentEl.innerHTML = '';
    renderNoDrawsPlaceholder({
      eventId,
      target: contentEl,
      onDrawAdded: (result: any) => {
        if (result?.drawDefinition?.drawId) {
          navigateToEvent({ eventId, drawId: result.drawDefinition.drawId, renderDraw: true });
        }
      },
    });
  }
}

function renderEntriesTab(eventId: string, drawId: string | undefined): void {
  renderEventTabsBar({ eventId, drawId, activeTab: 'entries' });
  createUnifiedEntriesPanel({ eventId, drawId });
  setEventView({ eventId });
}
