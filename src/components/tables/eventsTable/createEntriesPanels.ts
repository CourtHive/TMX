/**
 * Creates entry panels for events with dynamic tables for different entry statuses.
 * Manages multiple Tabulator instances for accepted, qualifying, alternates, etc.
 */
import { editAvoidances } from 'components/drawers/avoidances/editAvoidances';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { findAncestor, getParent } from 'services/dom/parentAndChild';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { removeAllChildNodes } from 'services/dom/transformers';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { addFlights } from 'components/modals/addFlights/addFlights';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { getEntriesColumns } from './getEntriesColumns';
import { panelDefinitions } from './panelDefinitions';
import { controlBar } from 'courthive-components';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import {
  CONTROL_BAR,
  EMPTY_STRING,
  ENTRIES_COUNT,
  EVENT_CONTROL,
  LEFT,
  NONE,
  RIGHT,
  TMX_PANEL,
  TMX_TABLE,
} from 'constants/tmxConstants';

export function createEntriesPanels({
  headerElement,
  eventId,
  drawId,
}: {
  headerElement?: HTMLElement;
  eventId: string;
  drawId?: string;
}): void {
  if (!eventId || eventId === 'undefined') context.router?.navigate('/');

  let searchFilter: ((rowData: any) => boolean) | undefined;
  const setSearchFilter = (value: string) => {
    if (searchFilter) Object.values(context.tables).forEach((table: any) => table.removeFilter(searchFilter));
    const searchText = value?.toLowerCase();
    searchFilter = (rowData: any) => rowData.searchText?.includes(searchText);
    if (value) {
      Object.values(context.tables).forEach((table: any) => table.addFilter(searchFilter));
    } else {
      searchFilter = undefined;
    }
  };

  const getTableData = () => {
    const { event, drawDefinition } = tournamentEngine.getEvent({ eventId, drawId });
    if (headerElement) headerElement.innerHTML = event?.eventName;

    if (!event) return { error: 'EVENT_NOT_FOUND' };

    const { participants, derivedDrawInfo } =
      tournamentEngine.getParticipants({
        participantFilters: { eventIds: [eventId] },
        withIndividualParticipants: true,
        withScaleValues: true,
        withDraws: true,
        withISO2: true,
      }) ?? {};

    const hasDrawDefinitions = event?.drawDefinitions?.length > 0;

    const categoryName = event.category?.categoryName ?? event.category?.ageCategoryCode;

    // Build participantId → drawPosition map from main structure position assignments
    const drawPositionMap: Record<string, number> = {};
    if (drawDefinition?.structures) {
      for (const structure of drawDefinition.structures) {
        for (const pa of structure.positionAssignments || []) {
          if (pa.participantId && pa.drawPosition) {
            drawPositionMap[pa.participantId] = pa.drawPosition;
          }
        }
      }
    }

    // Build participantId → draws map from all drawDefinitions' entries
    // This ensures draw chips show regardless of position assignment or flight profile status
    const participantDrawsMap: Record<string, { drawId: string; drawName: string; eventId: string }[]> = {};
    if (hasDrawDefinitions) {
      for (const dd of event.drawDefinitions) {
        for (const entry of dd.entries || []) {
          if (!participantDrawsMap[entry.participantId]) participantDrawsMap[entry.participantId] = [];
          participantDrawsMap[entry.participantId].push({ drawId: dd.drawId, drawName: dd.drawName, eventId });
        }
      }
    }

    const entryData = (drawDefinition?.entries || event?.entries || []).map((entry: any) =>
      mapEntry({
        eventType: event.eventType,
        participantDrawsMap,
        drawPositionMap,
        derivedDrawInfo,
        categoryName,
        participants,
        eventId,
        entry,
      }),
    );

    const { events } = tournamentEngine.getEvents();
    return {
      tableData: panelDefinitions({ event, drawDefinition, participants, entryData, hasDrawDefinitions }),
      events,
      event,
    };
  };

  const render = (data: any[]) => {
    for (const panelDef of data) {
      const { entries, group, anchorId, placeholder, excludeColumns: exclude, actions, drawCreated } = panelDef;
      const panelElement = document.getElementById(anchorId);
      if (panelElement) {
        panelElement.style.display = panelDef.hide ? NONE : EMPTY_STRING;
        removeAllChildNodes(panelElement);
        const controlElement = document.createElement('div');
        controlElement.className = `${CONTROL_BAR} flexcol flexcenter`;
        panelElement.appendChild(controlElement);

        const tableElement = document.createElement('div');
        tableElement.className = `${TMX_TABLE} flexcol flexcenter`;
        panelElement.appendChild(tableElement);

        const entriesColumns = getEntriesColumns({ actions, exclude, entries, eventId, drawId, drawCreated });
        // Dynamically collect rating field names for headerSortElement exclusion
        const ratingFields = entriesColumns
          .filter((col: any) => col.field?.startsWith('ratings.'))
          .map((col: any) => col.field);

        const table = new Tabulator(tableElement, {
          headerSortElement: headerSortElement([
            ...ratingFields,
            'drawPosition',
            'seedNumber',
            'ranking',
            'status',
            'flights',
          ]),
          columns: entriesColumns,
          responsiveLayout: 'collapse',
          index: 'participantId',
          layout: 'fitColumns',
          reactiveData: true,
          height: '400px',
          data: entries,
          placeholder,
        });
        context.tables[group] = table;

        const tmxPanel = findAncestor(panelElement, TMX_PANEL);
        table.on('tableBuilt', () => {
          const items = panelDef.items?.map((item: any) => (isFunction(item) ? item(table) : item));
          controlBar({ target: controlElement, table, items, onSelection: panelDef.onSelection });
          if (!entries.length && panelDef.togglePanel) {
            panelDef.togglePanel({ target: tmxPanel, table, close: true });
          }
        });
        table.on('dataChanged', () => {
          const tableClass = getParent(table.element, 'tableClass');
          const controlBar = (tableClass as any)?.parent?.getElementsByClassName('controlBar')?.[0];
          const entriesCount = controlBar?.getElementsByClassName(ENTRIES_COUNT)?.[0];
          const itemCount = table.getData().length;

          if (panelDef.togglePanel && !itemCount) {
            panelDef.togglePanel({ target: tmxPanel, table, close: true });
          }

          if (entriesCount) entriesCount.innerHTML = itemCount || 0;
        });
      }
    }
  };

  const result = getTableData();

  if (!result.error) {
    const ALL_ENTRIES = 'All entries';
    const eventControlElement = document.getElementById(EVENT_CONTROL) || undefined;

    const eventEntries = { label: ALL_ENTRIES, onClick: () => navigateToEvent({ eventId }), close: true };
    const entriesOptions = (result.event.drawDefinitions || [])
      .map((drawDefinition: any) => ({
        onClick: () => navigateToEvent({ eventId, drawId: drawDefinition.drawId }),
        label: drawDefinition?.drawName,
        close: true,
      }))
      .concat([{ divider: true } as any, eventEntries]);
    const drawName = result.event?.drawDefinitions?.find((d: any) => d?.drawId === drawId)?.drawName;

    const drawAdded = (result: any) => {
      if (result.success) {
        navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
      }
    };

    const items = [
      {
        onKeyDown: (e: any) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
        onChange: (e: any) => setSearchFilter(e.target.value),
        onKeyUp: (e: any) => setSearchFilter(e.target.value),
        clearSearch: () => setSearchFilter(''),
        placeholder: 'Search entries',
        location: LEFT,
        search: true,
      },
      { label: drawName || ALL_ENTRIES, options: entriesOptions, location: LEFT },
      {
        onClick: () => editAvoidances({ eventId }),
        intent: 'is-warning',
        id: 'editAvoidances',
        label: 'Avoidances',
        location: RIGHT,
      },
      {
        onClick: () => addFlights({ eventId, callback: () => navigateToEvent({ eventId }) }),
        intent: 'is-info',
        label: 'Add flights',
        location: RIGHT,
        hide: !!drawId,
      },
      {
        onClick: () => addDraw({ eventId, callback: drawAdded }),
        intent: 'is-primary',
        label: 'Add draw',
        location: RIGHT,
      },
    ];

    controlBar({ target: eventControlElement, items });
    if (result.tableData) render(result.tableData);
  }
}
