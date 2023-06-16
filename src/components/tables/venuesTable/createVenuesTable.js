import { toggleOpenClose, openClose } from '../common/formatters/openClose';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapVenue } from 'Pages/Tournament/Tabs/venuesTab/mapVenue';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'components/controlBar/controlBar';
import { competitionEngine } from 'tods-competition-factory';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { threeDots } from '../common/formatters/threeDots';
import { getLatLong } from 'components/modals/getLatLong';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, NONE, OVERLAY, RIGHT, SUB_TABLE, TOURNAMENT_VENUES } from 'constants/tmxConstants';
import { MODIFY_VENUE } from 'constants/mutationConstants';

export function createVenuesTable({ table } = {}) {
  let ready = !!table;

  const venueActions = () => console.log('Venue actions');
  const courtActions = () => console.log('Court actions');

  const lightsFormatter = (cell) => {
    const value = cell.getValue();
    const hasLights = `<i class="fa-solid fa-check" style="color: green"></i>`;
    const noLights = `<i class="fa-solid fa-xmark"></i>`;
    return value ? hasLights : noLights;
  };

  const subTableFormatter = (row) => {
    const holderEl = document.createElement('div');
    const controlEl = document.createElement('div');
    controlEl.className = 'tableControl';
    controlEl.style.marginBottom = '1em';

    const items = [
      {
        label: 'Delete selected',
        intent: 'is-danger',
        stateChange: true,
        location: OVERLAY
      },
      {
        label: 'Add courts',
        location: RIGHT,
        align: RIGHT
      }
    ];

    holderEl.appendChild(controlEl);

    const borderStyle = '1px solid #333';
    const tableEl = document.createElement('div');
    tableEl.style.backgroundColor = 'white'; // avoid artifact in select column
    tableEl.style.border = borderStyle;
    tableEl.style.width = '99%';

    holderEl.className = SUB_TABLE;
    holderEl.style.display = NONE;
    holderEl.style.boxSizing = 'border-box';
    holderEl.style.paddingLeft = '10px';
    holderEl.style.borderTop = borderStyle;
    holderEl.style.borderBotom = borderStyle;

    holderEl.appendChild(tableEl);

    row.getElement().appendChild(holderEl);

    const courtsTable = new Tabulator(tableEl, {
      headerSortElement: headerSortElement([
        'courtName',
        'scheduledTime',
        'unscheduledTime',
        'floodlit',
        'surfaceType',
        'indoorOutdoor'
      ]),
      data: row.getData().courts,
      placeholder: 'No courts',
      layout: 'fitColumns',
      index: 'courtId',
      maxHeight: 400,
      columns: [
        {
          cellClick: (_, cell) => cell.getRow().toggleSelect(),
          titleFormatter: 'rowSelection',
          formatter: 'rowSelection',
          headerSort: false,
          hozAlign: LEFT,
          width: 5
        },
        {
          headerMenu: headerMenu({ floodlit: 'Lights' }),
          formatter: 'rownum',
          headerSort: false,
          hozAlign: CENTER,
          width: 55
        },
        { title: 'Court Name', field: 'courtName', editor: true },
        { title: 'Scheduled Time', field: 'scheduledTime' },
        { title: 'Unscheduled Time', field: 'unscheduledTime' },
        { title: 'In/Out', field: 'indoorOutdoor' },
        { title: 'Surface', field: 'surfaceType' },
        {
          title: `<i class="fa-regular fa-lightbulb"></i>`,
          formatter: lightsFormatter,
          headerTooltip: 'Lights',
          field: 'floodlit',
          width: 50
        },
        {
          cellClick: courtActions,
          formatter: threeDots,
          responsive: false,
          headerSort: false,
          hozAlign: RIGHT,
          width: 50
        }
      ]
    });

    controlBar({ table: courtsTable, target: controlEl, items });

    courtsTable.on('cellEdited', (cell) => {
      const def = cell.getColumn().getDefinition();
      const row = cell.getRow().getData();
      const value = cell.getValue();
      console.log({ cell, row, value, def });
    });
  };

  const locationFormatter = (cell) => {
    const value = cell.getValue();
    const undef = `?`;
    const def = `<i class="fa-sharp fa-solid fa-location-dot" style="color: blue"></i>`;
    return value ? def : undef;
  };

  const getTableData = () => {
    const { venues } = competitionEngine.getVenuesAndCourts();
    const rows = venues.map(mapVenue);
    return { rows };
  };

  const replaceTableData = () => {
    const refresh = () => {
      const { rows } = getTableData();
      table?.replaceData(rows);
    };

    setTimeout(refresh, ready ? 0 : 1000);
  };

  const setLatLong = (e, cell) => {
    const rowData = cell.getRow().getData();
    const { latitude, longitude } = rowData?.address || {};
    const callback = (value = {}) => {
      if (!rowData.address) rowData.address = {};
      const venue = rowData.venue;
      if (!venue.addresses) venue.addresses = [];
      if (!venue.addresses.length) {
        venue.addresses.push({ latitude: value.latitude, longitude: value.longitude });
      } else {
        Object.assign(venue.addresses[0], { latitude: value.latitude, longitude: value.longitude });
      }

      const postMutation = (result) => {
        if (result.results?.[0]?.success) {
          rowData.address.latitude = value.latitude;
          rowData.address.longitude = value.longitude;
          rowData.hasLocation = value.latitude && value.longitude;
          table.updateData([rowData]);
        }
      };

      const methods = [
        {
          method: MODIFY_VENUE,
          params: {
            venueId: rowData.venueId,
            modifications: venue
          }
        }
      ];
      mutationRequest({ methods, callback: postMutation });
    };

    getLatLong({ coords: { latitude, longitude }, callback });
  };

  const columns = [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      hozAlign: LEFT,
      width: 5
    },
    {
      headerMenu: headerMenu({
        scheduledMatchUpsCount: 'Scheduled matches',
        availableTime: 'Time Available',
        courtsCount: 'Number of courts',
        hasLocation: 'Location'
      }),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: CENTER,
      width: 55
    },
    {
      cellClick: toggleOpenClose,
      field: 'venueAbbreviation',
      title: 'Abbr',
      visible: true,
      width: 120
    },
    {
      cellClick: toggleOpenClose,
      field: 'venueName',
      title: 'Venue',
      visible: true,
      minWidth: 200,
      widthGrow: 3
    },
    {
      title: `<div class="event_icon surface_header"></div>`,
      headerTooltip: 'Number of courts',
      headerHozAlign: CENTER,
      field: 'courtsCount',
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 50
    },
    {
      title: 'Scheduled',
      headerTooltip: 'Scheduled matches',
      field: 'scheduledMatchUpsCount',
      headerHozAlign: CENTER,
      headerSort: true,
      hozAlign: CENTER,
      visible: true,
      minWidth: 120
    },
    {
      title: 'Time',
      headerHozAlign: CENTER,
      field: 'availableTime',
      headerSort: true,
      hozAlign: CENTER,
      visible: true,
      minWidth: 120
    },
    {
      title: `<i class="fa-sharp fa-solid fa-location-dot"></i>`,
      formatter: locationFormatter,
      headerTooltip: 'Location',
      headerHozAlign: CENTER,
      cellClick: setLatLong,
      field: 'hasLocation',
      headerSort: false,
      hozAlign: CENTER,
      visible: true,
      width: 50
    },
    {
      cellClick: toggleOpenClose,
      formatter: openClose,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      field: 'isOpen',
      width: 20
    },
    {
      cellClick: venueActions,
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 50
    }
  ];

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
      rowFormatter: subTableFormatter,
      placeholder: 'No venues',
      layout: 'fitColumns',
      reactiveData: true,
      index: 'venueId',
      columns,
      data
    });

    table.on('cellEdited', (cell) => {
      const def = cell.getColumn().getDefinition();
      const row = cell.getRow().getData();
      const value = cell.getValue();
      console.log({ cell, row, value, def });
    });
    table.on('tableBuilt', () => (ready = true));
  } else {
    replaceTableData();
  }

  return { table, replaceTableData };
}
