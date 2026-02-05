import { headerSortElement } from '../common/sorters/headerSortElement';
import { mapVenue } from 'pages/tournament/tabs/venuesTab/mapVenue';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { competitionEngine } from 'tods-competition-factory';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { venueRowFormatter } from './venueRowFormatter';
import { getVenuesColumns } from './getVenueColumns';

import { TOURNAMENT_VENUES } from 'constants/tmxConstants';

type CreateVenuesTableResult = {
  table: any;
  replaceTableData: () => void;
};

export function createVenuesTable({ table }: { table?: any } = {}): CreateVenuesTableResult {
  const nestedTables = new Map();
  const setNestedTable = (venueId: string, courtsTable: any) => {
    if (nestedTables.has(venueId)) return;
    nestedTables.set(venueId, courtsTable);
  };

  const getTableData = () => {
    const { venues } = competitionEngine.getVenuesAndCourts();
    const rows = venues.map(mapVenue);
    return { rows };
  };

  const replaceTableData = () => {
    const { rows } = getTableData();
    table?.replaceData(rows);
  };

  const columns = getVenuesColumns(nestedTables);

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
        'venueName',
      ]),
      minHeight: window.innerHeight * 0.81,
      rowFormatter: venueRowFormatter(setNestedTable),
      placeholder: 'No venues',
      layout: 'fitColumns',
      reactiveData: true,
      index: 'venueId',
      columns,
      data,
    });

    table.on('scrollVertical', destroyTipster);
    table.on('cellEdited', (cell: any) => {
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
