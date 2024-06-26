import { getAttachedAvoidances } from 'components/drawers/avoidances/getAttachedAvoidances';
import { editAvoidances } from 'components/drawers/avoidances/editAvoidances';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { findAncestor, getParent } from 'services/dom/parentAndChild';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { removeAllChildNodes } from 'services/dom/transformers';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'components/controlBar/controlBar';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { getEntriesColumns } from './getEntriesColumns';
import { displayAllEvents } from './displayAllEvents';
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
  TMX_TABLE,
} from 'constants/tmxConstants';

export function createEntriesPanels({ eventId, drawId, headerElement }) {
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

    const hasFlights = event?.drawDefinitions?.length > 1;

    // TODO: flightProfile.flight.entries ...
    const categoryName = event.category?.categoryName ?? event.category?.ageCategoryCode;
    const entryData = (drawDefinition?.entries || event?.entries || []).map((entry) =>
      mapEntry({
        eventType: event.eventType,
        derivedDrawInfo,
        categoryName,
        participants,
        eventId,
        entry,
      }),
    );

    const { events } = tournamentEngine.getEvents();
    return {
      tableData: panelDefinitions({ event, drawDefinition, participants, entryData, hasFlights }),
      events,
      event,
    };
  };

  const render = (data) => {
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

        const table = new Tabulator(tableElement, {
          headerSortElement: headerSortElement([
            'ratings.utr',
            'ratings.wtn',
            'seedNumber',
            'ranking',
            'cityState',
            'status',
            'flights',
          ]),
          columns: getEntriesColumns({ actions, exclude, entries, eventId, drawId, drawCreated }),
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
    const entriesOptions = (result.event.drawDefinitions || []) // TODO: use flightProfile.flights
      .map((drawDefinition) => ({
        onClick: () => navigateToEvent({ eventId, drawId: drawDefinition.drawId }),
        label: drawDefinition?.drawName,
        close: true,
      }))
      .concat([{ divider: true }, eventEntries]);
    const allEvents = { label: ALL_EVENTS, onClick: displayAllEvents, close: true };
    const eventOptions = result.events
      .map((e) => ({
        onClick: () => navigateToEvent({ eventId: e.eventId }),
        label: e.eventName,
        close: true,
      }))
      .concat([{ divider: true }, allEvents]);

    const drawAdded = (result) => {
      if (result.success) {
        navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
      }
    };

    const addDrawOption = {
      label: `<div style='font-weight: bold'>Add draw</div>`,
      onClick: () => addDraw({ eventId, callback: drawAdded }),
    };
    const drawOptions = result.event.drawDefinitions
      ?.map((d) => ({
        onClick: () => navigateToEvent({ eventId, drawId: d?.drawId, renderDraw: true }),
        label: d?.drawName,
        close: true,
      }))
      .concat([{ divider: true }, addDrawOption]);
    const drawName = result.event?.drawDefinitions?.find((d) => d?.drawId === drawId)?.drawName;

    const generateFlights = ({ eventId }) => {
      console.log('generateFlights', { eventId });
      /*
      // EXAMPLE only!
      const methods = [
        {
          method: GENERATE_FLIGHT_PROFILE,
          params: {
            scaledEntries: [...],
            flightsCount: '2',
            splitMethod: 'splitShuttle',
            scaleAttributes: {
              scaleType: 'RANKING',
              eventType: 'SINGLES',
              scaleName: 'U16'
            },
            drawNames: ['Flight A', 'Flight B'],
            eventId: 'E0B3E1F0-event-2',
            uuids: []
          }
        },
        // this second payload is generated by the first, so methods can't be used here!!
        {
          method: ATTACH_FLIGHT_PROFILE,
          params: {
            deleteExisting: true,
            flightProfile: {
              scaleAttributes: {
                scaleType: 'RANKING',
                eventType: 'SINGLES',
                scaleName: 'U16'
              },
              splitMethod: 'splitShuttle',
              flights: [
                {
                  flightNumber: 1,
                  drawId: 'ab1d9955-e9d5-41cc-bf04-6bd941d1f9b4',
                  drawEntries: [...],
                  drawName: 'Flight A'
                },
                {
                  flightNumber: 1,
                  drawId: 'f00ba626-e3d0-4ff2-af8a-55ece592106c',
                  drawEntries: [...],
                  drawName: 'Flight B'
                }
              ]
            },
            eventId: 'E0B3E1F0-event-2'
          }
        }
      ];
      */
    };

    const avoidancesIntent = getAttachedAvoidances({ eventId })?.length ? 'is-success' : NONE;

    const items = [
      {
        onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
        onChange: (e) => setSearchFilter(e.target.value),
        onKeyUp: (e) => setSearchFilter(e.target.value),
        clearSearch: () => setSearchFilter(''),
        placeholder: 'Search entries',
        location: LEFT,
        search: true,
      },
      { label: result.event.eventName, options: eventOptions.length > 1 && eventOptions, location: LEFT },
      { label: drawName || ALL_ENTRIES, options: entriesOptions, location: LEFT },
      {
        onClick: () => navigateToEvent({ eventId, drawId, renderDraw: true }),
        label: 'View draw',
        intent: 'is-info',
        location: RIGHT,
        hide: !drawId,
      },
      {
        onClick: () => editAvoidances({ eventId }),
        intent: avoidancesIntent,
        id: 'editAvoidances',
        label: 'Avoidances',
        location: RIGHT,
      },
      {
        onClick: () => generateFlights({ eventId, callback: () => {} }),
        label: 'Flights',
        location: RIGHT,
        hide: drawId,
        intent: NONE,
      },
      {
        options: drawOptions?.length > 2 && drawOptions,
        hide: (drawOptions?.length || 0) < 3 || drawId,
        intent: 'is-info',
        location: RIGHT,
        label: 'Draws',
        align: RIGHT,
      },
      {
        onClick: () => addDraw({ eventId, callback: drawAdded }),
        hide: drawOptions?.length > 2 || drawId,
        intent: 'is-info',
        label: 'Add draw',
        location: RIGHT,
      },
    ];

    controlBar({ target: eventControlElement, items });
    render(result.tableData);
  }
}
