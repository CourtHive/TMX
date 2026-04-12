/**
 * Render events tab with 3-zone layout:
 * 1. Compact event selector (or full events table when no event selected)
 * 2. Event tabs bar (Draws / Entries / Rankings)
 * 3. Tab content (draw view, entries panels, points table, or add-draw placeholder)
 */
import { createEntriesPanels } from 'components/tables/eventsTable/createEntriesPanels';
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
import { tournamentEngine, drawDefinitionConstants, extensionConstants } from 'tods-competition-factory';
import { controlBar } from 'courthive-components';
import {
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
      (createEntriesPanels as any)({ eventId, drawId });
      setEventView({ eventId });
    }
  } else {
    renderDrawsListOrPlaceholder(eventId, renderDraw);
  }
}

function renderDrawsListOrPlaceholder(eventId: string, renderDraw: boolean | undefined): void {
  const event = tournamentEngine.getEvent({ eventId })?.event;
  const drawDefs = event?.drawDefinitions || [];

  const flightProfile = event?.extensions?.find(
    (ext: any) => ext.name === extensionConstants.FLIGHT_PROFILE,
  )?.value;
  const ungeneratedCount =
    flightProfile?.flights?.filter((f: any) => !drawDefs.some((dd: any) => dd.drawId === f.drawId))?.length || 0;
  const totalDrawItems = drawDefs.length + ungeneratedCount;

  if (totalDrawItems > 0) {
    renderDrawsTableView(eventId, event, renderDraw);
  } else {
    renderNoDrawsView(eventId, renderDraw);
  }
}

function renderDrawsTableView(eventId: string, _event: any, renderDraw: boolean | undefined): void {
  renderEventTabsBar({ eventId, activeTab: 'draws' });
  setEventView({ renderDraw });
  const contentEl = document.getElementById(DRAWS_VIEW);
  if (!contentEl) return;

  contentEl.innerHTML = '';
  const drawsTable = renderDrawsTable({ eventId, target: contentEl });
  if (!drawsTable) return;

  const deleteSelectedDraws = () => {
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

  const drawAdded = (result: any) => {
    if (result.success) {
      navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
    }
  };

  const controlTarget = document.getElementById(EVENT_CONTROL) || undefined;
  if (controlTarget) {
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
  (createEntriesPanels as any)({ eventId, drawId });
  setEventView({ eventId });
}
