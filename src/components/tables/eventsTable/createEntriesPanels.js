import { headerSortElement } from '../common/sorters/headerSortElement';
import { findParentByClassName } from 'services/dom/findParentByClass';
import { mapEntry } from 'Pages/Tournament/Tabs/eventsTab/mapEntry';
import { removeAllChildNodes } from 'services/dom/transformers';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'components/controlBar/controlBar';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { getEntriesColumns } from './getEntriesColumns';
import { getParent } from 'services/dom/parentAndChild';
import { displayAllEvents } from './displayAllEvents';
import { addDraw } from 'components/drawers/addDraw';
import { panelDefinitions } from './panelDefinitions';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import {
  ALL_EVENTS,
  CONTROL_BAR,
  EMPTY_STRING,
  ENTRIES_COUNT,
  EVENT_CONTROL,
  LEFT,
  NONE,
  RIGHT,
  TMX_PANEL,
  TMX_TABLE
} from 'constants/tmxConstants';

export function createEntriesPanels({ eventId, drawId }) {
  if (!eventId || eventId === 'undefined') context.router.navigate('/');

  // global search across all tables
  // NOTE: cannot use createSearchFilter because context.tables is a dynamic object
  let searchFilter;
  const setSearchFilter = (value) => {
    if (searchFilter) Object.values(context.tables).forEach((table) => table.removeFilter(searchFilter));
    const searchText = value?.toLowerCase();
    searchFilter = (rowData) => rowData.searchText?.includes(searchText);
    if (value) {
      Object.values(context.tables).forEach((table) => table.addFilter(searchFilter));
    } else {
      searchFilter = undefined;
    }
  };

  const getTableData = () => {
    const { event, drawDefinition } = tournamentEngine.getEvent({ eventId, drawId });

    if (!event) return { error: 'EVENT_NOT_FOUND' };

    const { participants, derivedDrawInfo } = tournamentEngine.getParticipants({
      participantFilters: { eventIds: [eventId] },
      withIndividualParticipants: true,
      withScaleValues: true,
      withDraws: true
    });

    const hasFlights = event?.drawDefinitions?.length > 1;

    const entryData = (drawDefinition?.entries || event?.entries || []).map((entry) =>
      mapEntry({ entry, derivedDrawInfo, participants, eventType: event.eventType, eventId })
    );

    const { events } = tournamentEngine.getEvents();
    return { events, event, tableData: panelDefinitions({ event, drawDefinition, entryData, hasFlights }) };
  };

  const render = (data) => {
    for (const panelDef of data) {
      const { entries, group, anchorId, placeholder, excludeColumns: exclude, actions } = panelDef;
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

        const table = new Tabulator(tableElement, {
          headerSortElement: headerSortElement([
            'ratings.wtn.wtnRating',
            'seedNumber',
            'ranking',
            'cityState',
            'status',
            'flights'
          ]),
          columns: getEntriesColumns({ actions, exclude, eventId, drawId }),
          responsiveLayout: 'collapse',
          index: 'participantId',
          layout: 'fitColumns',
          reactiveData: true,
          height: '400px',
          data: entries,
          placeholder
        });
        context.tables[group] = table;

        const tmxPanel = findParentByClassName(panelElement, TMX_PANEL);
        table.on('tableBuilt', () => {
          const items = panelDef.items?.map((item) => (isFunction(item) ? item(table) : item));
          controlBar({ target: controlElement, table, items, onSelection: panelDef.onSelection });
          if (!entries.length && panelDef.togglePanel) {
            panelDef.togglePanel({ target: tmxPanel, table, close: true });
          }
        });
        table.on('dataChanged', () => {
          const tableClass = getParent(table.element, 'tableClass');
          const controlBar = tableClass.getElementsByClassName('controlBar')?.[0];
          const entriesCount = controlBar.getElementsByClassName(ENTRIES_COUNT)?.[0];
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
    const eventControlElement = document.getElementById(EVENT_CONTROL);
    const eventEntries = { label: ALL_ENTRIES, onClick: () => navigateToEvent({ eventId }), close: true };
    const entriesOptions = (result.event.drawDefinitions || [])
      .map((drawDefinition) => ({
        onClick: () => navigateToEvent({ eventId, drawId: drawDefinition.drawId }),
        label: drawDefinition.drawName,
        close: true
      }))
      .concat([{ divider: true }, eventEntries]);
    const allEvents = { label: ALL_EVENTS, onClick: displayAllEvents, close: true };
    const eventOptions = result.events
      .map((e) => ({
        onClick: () => navigateToEvent({ eventId: e.eventId }),
        label: e.eventName,
        close: true
      }))
      .concat([{ divider: true }, allEvents]);

    const drawAdded = (result) => {
      if (result.success) {
        navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
      }
    };

    const addDrawOption = {
      label: `<div style='font-weight: bold'>Add draw</div>`,
      onClick: () => addDraw({ eventId, callback: drawAdded })
    };
    const drawOptions = result.event.drawDefinitions
      ?.map((d) => ({
        onClick: () => navigateToEvent({ eventId, drawId: d.drawId, renderDraw: true }),
        label: d.drawName,
        close: true
      }))
      .concat([{ divider: true }, addDrawOption]);
    const drawName = result.event?.drawDefinitions?.find((d) => d.drawId === drawId)?.drawName;
    const items = [
      {
        onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
        onChange: (e) => setSearchFilter(e.target.value),
        onKeyUp: (e) => setSearchFilter(e.target.value),
        placeholder: 'Search entries',
        location: LEFT,
        search: true
      },
      { label: result.event.eventName, options: eventOptions.length > 1 && eventOptions, location: LEFT },
      { label: drawName || ALL_ENTRIES, options: entriesOptions, location: LEFT },
      {
        onClick: () => navigateToEvent({ eventId, drawId, renderDraw: true }),
        label: 'View draw',
        intent: 'is-info',
        location: RIGHT,
        hide: !drawId
      },
      {
        options: drawOptions?.length > 2 && drawOptions,
        hide: drawOptions?.length < 3 || drawId,
        intent: 'is-info',
        location: RIGHT,
        label: 'Draws',
        align: RIGHT
      },
      {
        onClick: () => addDraw({ eventId, callback: drawAdded }),
        hide: drawOptions?.length > 2 || drawId,
        intent: 'is-info',
        label: 'Add draw',
        location: RIGHT
      }
    ];
    controlBar({ target: eventControlElement, items });
    render(result.tableData);
  }
}
