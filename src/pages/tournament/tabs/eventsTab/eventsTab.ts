/**
 * Render events tab with 3-zone layout:
 * 1. Compact event selector (or full events table when no event selected)
 * 2. Event tabs bar (Draws / Entries / Rankings)
 * 3. Tab content (draw view, entries panels, points table, or add-draw placeholder)
 */
import { createEntriesPanels } from 'components/tables/eventsTable/createEntriesPanels';
import { createRoundsTable } from 'components/tables/roundsTable/createRoundsTable';
import { createBracketTable } from 'components/tables/bracketTable/createBracketTable';
import { createStatsTable } from 'components/tables/statsTable/createStatsTable';
import { createPointsTable } from 'components/tables/pointsTable/createPointsTable';
import { setEventView } from 'components/tables/eventsTable/setEventView';
import { renderEventTabsBar, renderNoDrawsPlaceholder } from './eventTabsBar';
import { renderEventSelector, hideEventSelector } from './eventSelector';
import { destroyTables } from 'pages/tournament/destroyTable';
import { renderDrawsTable } from './renderDraws/renderDrawsTable';
import { renderDrawView } from './renderDraws/renderDrawView';
import { getActionOptions } from './renderDraws/getActionOptions';
import { cleanupDrawPanel } from './cleanupDrawPanel';
import { renderDrawPanel } from './renderDrawPanel';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { editDisplaySettings } from 'components/modals/displaySettings/editDisplaySettings';
import { deleteFlights } from 'components/modals/deleteFlights';
import { addFlights } from 'components/modals/addFlights/addFlights';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { tmxToast } from 'services/notifications/tmxToast';
import { editEvent } from './editEvent';
import { highlightTab } from 'navigation';
import { eventsView } from './eventsView';
import { t } from 'i18n';

// constants
import { tournamentEngine, drawDefinitionConstants, eventConstants, extensionConstants, tools } from 'tods-competition-factory';
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
const { TEAM } = eventConstants;

const FLEX_CENTER = 'display: flex; align-items: center;';

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
    // Points tab: create table first to get policy controls for the tabs bar
    const { policyControlsElement } = createPointsTable({ eventId });
    renderEventTabsBar({ eventId, drawId, activeTab: 'points', rightContent: policyControlsElement });
    setEventView({ renderPoints });
  } else if (renderDraw) {
    // Build Actions dropdown for the tabs bar right side
    let actionsElement: HTMLElement | undefined;
    if (drawId) {
      const eventData = tournamentEngine.getEventData({ eventId })?.eventData;
      const drawData = eventData?.drawsData?.find((d: any) => d.drawId === drawId);
      const sid = structureId || drawData?.structures?.[0]?.structureId;
      const structure = drawData?.structures?.find((s: any) => s.structureId === sid);
      const { roundMatchUps } = tools.makeDeepCopy(structure || {});
      const matchUps = Object.values(roundMatchUps || {}).flat();
      const dual = matchUps?.length === 1 && eventData?.eventInfo?.eventType === TEAM;

      const actionOptions = (getActionOptions as any)({
        dualMatchUp: dual && matchUps[0],
        structureId: sid,
        eventData,
        drawData,
        drawId,
      });

      actionsElement = document.createElement('div');
      actionsElement.style.cssText = FLEX_CENTER;
      controlBar({
        target: actionsElement,
        items: [{ options: actionOptions, intent: 'is-info', label: 'Actions', location: 'right', align: 'right' }],
      });
    }
    renderEventTabsBar({ eventId, drawId, activeTab: 'draws', rightContent: actionsElement });
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
      const event = tournamentEngine.getEvent({ eventId })?.event;
      const drawDefs = event?.drawDefinitions || [];

      // Check for ungenerated flights from flight profile extension
      const flightProfile = event?.extensions?.find((ext: any) => ext.name === extensionConstants.FLIGHT_PROFILE)?.value;
      const ungeneratedCount = flightProfile?.flights?.filter(
        (f: any) => !drawDefs.find((dd: any) => dd.drawId === f.drawId),
      )?.length || 0;
      const totalDrawItems = drawDefs.length + ungeneratedCount;

      if (totalDrawItems > 0) {
        // Multiple draws — show draws table with control bar
        const drawsActionsElement = document.createElement('div');
        drawsActionsElement.style.cssText = FLEX_CENTER;
        const drawsActionOptions = [
          {
            onClick: () => editDisplaySettings({ eventId }),
            label: 'Display settings',
            close: true,
          },
          {
            onClick: () => editEvent({ event, callback: () => navigateToEvent({ eventId, renderDraw: true }) }),
            label: t('pages.events.editEventAction', 'Edit event'),
            close: true,
          },
        ];
        controlBar({
          target: drawsActionsElement,
          items: [{ options: drawsActionOptions, intent: 'is-info', label: 'Actions', location: 'right', align: 'right' }],
        });

        renderEventTabsBar({ eventId, activeTab: 'draws', rightContent: drawsActionsElement });
        setEventView({ renderDraw });
        const contentEl = document.getElementById(DRAWS_VIEW);
        if (contentEl) {
          contentEl.innerHTML = '';
          const drawsTable = renderDrawsTable({ eventId, target: contentEl });

          if (drawsTable) {
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
                // If all draws deleted, refresh to show placeholder
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
                    onClick: () => addFlights({ eventId, callback: () => navigateToEvent({ eventId, renderDraw: true }) }),
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
        }
      } else {
        // No draws — show Add Draw placeholder
        renderEventTabsBar({ eventId, activeTab: 'draws' });
        setEventView({ renderDraw });
        // Hide control bar area for placeholder view
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
    }
  } else {
    // Entries tab — build Actions dropdown for the tabs bar
    const event = tournamentEngine.getEvent({ eventId })?.event;
    const entriesActionOptions = [
      {
        onClick: () => editDisplaySettings({ eventId }),
        label: 'Display settings',
        close: true,
      },
      {
        onClick: () => editEvent({ event, callback: () => navigateToEvent({ eventId }) }),
        label: t('pages.events.editEventAction', 'Edit event'),
        close: true,
      },
    ];
    const entriesActionsElement = document.createElement('div');
    entriesActionsElement.style.cssText = FLEX_CENTER;
    controlBar({
      target: entriesActionsElement,
      items: [{ options: entriesActionOptions, intent: 'is-info', label: 'Actions', location: 'right', align: 'right' }],
    });

    renderEventTabsBar({ eventId, drawId, activeTab: 'entries', rightContent: entriesActionsElement });
    (createEntriesPanels as any)({ eventId, drawId });
    setEventView({ eventId });
  }
}
