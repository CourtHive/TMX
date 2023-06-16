import { headerSortElement } from '../common/sorters/headerSortElement';
import { mapEntry } from 'Pages/Tournament/Tabs/eventsTab/mapEntry';
import { removeAllChildNodes } from 'services/dom/transformers';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'components/controlBar/controlBar';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { panelDefinitions } from './panelDefinitions';
import { addDraw } from 'components/drawers/addDraw';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { getColumns } from './getColumns';

import {
  CONTROL_BAR,
  EMPTY_STRING,
  EVENT_CONTROL,
  LEFT,
  NONE,
  RIGHT,
  TMX_TABLE,
  TOURNAMENT,
  EVENTS_TAB
} from 'constants/tmxConstants';

export function createEntriesPanels({ eventId, drawId }) {
  if (!eventId || eventId === 'undefined') context.router.navigate('/');

  let searchText;
  // global search across all tables
  const searchFilter = (rowData) => rowData.searchText?.includes(searchText);
  const updateSearchFilter = (value) => {
    if (!value) Object.values(context.tables).forEach((table) => table.removeFilter(searchFilter));
    searchText = value?.toLowerCase();
    if (value) Object.values(context.tables).forEach((table) => table.addFilter(searchFilter));
  };

  const getTableData = () => {
    const { event, drawDefinition } = tournamentEngine.getEvent({ eventId, drawId });

    if (!event) return { error: 'EVENT_NOT_FOUND' };

    const { participants } = tournamentEngine.getParticipants({
      participantFilters: { eventIds: [eventId] },
      withIndividualParticipants: true,
      withScaleValues: true,
      withDraws: true
    });

    const hasFlights = event?.drawDefinitions?.length > 1;

    const entryData = (drawDefinition?.entries || event?.entries || []).map((entry) =>
      mapEntry({ entry, participants, eventType: event.eventType })
    );

    const { events } = tournamentEngine.getEvents();
    return { events, event, tableData: panelDefinitions({ event, drawDefinition, entryData, hasFlights }) };
  };

  const render = (data) => {
    for (const panelDef of data) {
      const { entries: data, group, anchorId, placeholder, excludeColumns: exclude, actions } = panelDef;
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
          columns: getColumns({ actions, exclude, eventId, drawId }),
          responsiveLayout: 'collapse',
          index: 'participantId',
          layout: 'fitColumns',
          reactiveData: true,
          placeholder,
          data
        });
        context.tables[group] = table;

        table.on('tableBuilt', () => {
          const items = panelDef.items?.map((item) => (isFunction(item) ? item(table) : item));
          controlBar({ target: controlElement, table, items, onSelection: panelDef.onSelection });
        });
      }
    }
  };

  const result = getTableData();

  if (!result.error) {
    const ALL_ENTRIES = 'All entries';
    const eventControlElement = document.getElementById(EVENT_CONTROL);
    const eventEntries = { label: ALL_ENTRIES, onClick: () => navigateToEvent({ eventId }), close: true };
    const entriesOptions = [eventEntries].concat(
      (result.event.drawDefinitions || []).map((drawDefinition) => ({
        onClick: () => navigateToEvent({ eventId, drawId: drawDefinition.drawId }),
        label: drawDefinition.drawName,
        close: true
      }))
    );
    const displayAllEvents = () => {
      const tournamentId = tournamentEngine.getState().tournamentRecord.tournamentId;
      const eventsRoute = `/${TOURNAMENT}/${tournamentId}/${EVENTS_TAB}`;
      context.router.navigate(eventsRoute);
    };
    const allEvents = { label: 'All events', onClick: displayAllEvents, close: true };
    const eventOptions = [allEvents].concat(
      result.events.map((e) => ({
        onClick: () => navigateToEvent({ eventId: e.eventId }),
        label: e.eventName,
        close: true
      }))
    );

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
        onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
        onChange: (e) => updateSearchFilter(e.target.value),
        onKeyUp: (e) => updateSearchFilter(e.target.value),
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
        options: drawOptions?.length > 1 && drawOptions,
        hide: !drawOptions || drawId,
        intent: 'is-info',
        location: RIGHT,
        label: 'Draws'
      },
      {
        onClick: () => addDraw({ eventId, callback: drawAdded }),
        intent: 'is-info',
        label: 'Add draw',
        location: RIGHT,
        hide: drawOptions || drawId
      }
    ];
    controlBar({ target: eventControlElement, items });
    render(result.tableData);
  }
}
