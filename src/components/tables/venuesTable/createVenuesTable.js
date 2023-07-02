import { headerSortElement } from '../common/sorters/headerSortElement';
import { mapVenue } from 'Pages/Tournament/Tabs/venuesTab/mapVenue';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { competitionEngine } from 'tods-competition-factory';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { venueRowFormatter } from './venueRowFormatter';
import { getVenuesColumns } from './getVenueColumns';

import { TOURNAMENT_VENUES } from 'constants/tmxConstants';

export function createVenuesTable({ table } = {}) {
  const getTableData = () => {
    const { venues } = competitionEngine.getVenuesAndCourts();
    const rows = venues.map(mapVenue);
    return { rows };
  };

  const replaceTableData = () => {
    const { rows } = getTableData();
    table?.replaceData(rows);
  };

  const columns = getVenuesColumns();

  if (!table) {
    destroyTable({ anchorId: TOURNAMENT_VENUES });
    const element = document.getElementById(TOURNAMENT_VENUES);
    const { rows: data } = getTableData();

    table = new Tabulator(element, {
      headerSortElement: headerSortElement([
        'scheduledMatchUpsCount',
        'venueAbbreviation',
        'availableTime',
        'courtsCount',
        'venueName'
      ]),
      minHeight: window.innerHeight * 0.81,
      // height: // NOTE: setting a height causes scrolling issue
      rowFormatter: venueRowFormatter,
      placeholder: 'No venues',
      layout: 'fitColumns',
      reactiveData: true,
      index: 'venueId',
      columns,
      data
    });

    table.on('scrollVertical', destroyTipster);
    table.on('cellEdited', (cell) => {
      const def = cell.getColumn().getDefinition();
      const row = cell.getRow().getData();
      const value = cell.getValue();
      console.log({ cell, row, value, def });
    });
  } else {
    replaceTableData();
  }

  return { table, replaceTableData };
}
