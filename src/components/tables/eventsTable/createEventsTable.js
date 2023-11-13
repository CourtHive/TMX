import { headerSortElement } from '../common/sorters/headerSortElement';
import { mapEvent } from 'Pages/Tournament/Tabs/eventsTab/mapEvent';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { tournamentEngine } from 'tods-competition-factory';
import { findAncestor } from 'services/dom/parentAndChild';
import { eventRowFormatter } from './eventRowFormatter';
import { getEventColumns } from './getEventColumns';

import { TOURNAMENT_EVENTS } from 'constants/tmxConstants';

export function createEventsTable() {
  let table;

  const getTableData = () => {
    const eventData = tournamentEngine.getEvents({ withScaleValues: true });
    // TODO: optimization => pass mapEvent visible columns and only get inContext matchUps when necessary
    return eventData?.events?.map((event) =>
      mapEvent({ event, scaleValues: eventData.eventScaleValues?.[event.eventId] })
    );
  };

  const replaceTableData = () => {
    // TODO: add competitiveness column and/or highlight scores based on competitiveness
    // matchUp.competitiveness ['ROUTINE', 'DECISIVE', 'COMPETITIVE']
    table.replaceData(getTableData());
  };

  const columns = getEventColumns();

  const render = (data) => {
    destroyTable({ anchorId: TOURNAMENT_EVENTS });
    const element = document.getElementById(TOURNAMENT_EVENTS);
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader');
    headerElement && (headerElement.innerHTML = `Events (${data.length})`);

    table = new Tabulator(element, {
      columnDefaults: {}, // e.g. tooltip: true, //show tool tips on cells
      headerSortElement: headerSortElement([
        'scheduledMatchUpsCount',
        'completedMatchUpsCount',
        'matchUpsCount',
        'entriesCount',
        'drawsCount'
      ]),
      responsiveLayoutCollapseStartOpen: false,
      rowFormatter: eventRowFormatter,
      // minHeight: window.innerHeight * 0.8,
      height: window.innerHeight * 0.8,
      // height: // NOTE: setting a height causes scrolling issue
      responsiveLayout: 'collapse',
      placeholder: 'No events',
      layout: 'fitColumns',
      reactiveData: true, // updating row data will automatically update the table row!
      index: 'eventId',
      columns,
      data
    });
    table.on('scrollVertical', destroyTipster);
    table.on('dataChanged', (rows) => {
      headerElement && (headerElement.innerHTML = `Events (${rows.length})`);
    });
    table.on('dataFiltered', (filters, rows) => {
      headerElement && (headerElement.innerHTML = `Events (${rows.length})`);
    });
  };

  render(getTableData());

  return { table, replaceTableData };
}
