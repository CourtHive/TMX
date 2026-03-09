/**
 * Render a table of all draws for an event.
 * Shown when multiple draws exist and no specific draw is selected.
 * Includes ungenerated flights which are clickable to generate draws.
 * Returns the Tabulator instance for control bar integration.
 */
import { mapDrawDefinition } from 'pages/tournament/tabs/eventsTab/mapDrawDefinition';
import { headerSortElement } from 'components/tables/common/sorters/headerSortElement';
import { drawEntriesClick } from 'components/tables/eventsTable/drawEntriesClick';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { tournamentEngine, extensionConstants } from 'tods-competition-factory';
import { t } from 'i18n';

import { CENTER, DRAW_NAME, DRAW_TYPE, LEFT, UTR, WTN } from 'constants/tmxConstants';

export function renderDrawsTable({ eventId, target }: { eventId: string; target: HTMLElement }): any {
  const event = tournamentEngine.getEvent({ eventId })?.event;
  if (!event) return;

  const { drawDefinitions = [], extensions } = event;

  // Collect ungenerated flights from flight profile extension
  const ungeneratedFlights: any[] = [];
  const flightProfile = extensions?.find((ext: any) => ext.name === extensionConstants.FLIGHT_PROFILE)?.value;
  flightProfile?.flights?.forEach((flight: any) => {
    const hasDrawDef = drawDefinitions.find((dd: any) => dd.drawId === flight.drawId);
    if (hasDrawDef) {
      hasDrawDef.flightNumber = flight.flightNumber;
    } else {
      ungeneratedFlights.push({
        flightNumber: flight.flightNumber,
        entries: flight.drawEntries?.length || 0,
        drawName: flight.drawName,
        drawId: flight.drawId,
        generated: false,
      });
    }
  });

  const { scaleValues } = (tournamentEngine as any).getRatingsStats?.({ eventId }) || {};
  const generatedData = drawDefinitions.map((dd: any) => mapDrawDefinition(eventId)({ drawDefinition: dd, scaleValues }));
  const data = [...generatedData, ...ungeneratedFlights];

  if (!data.length) return;

  const utrAvg = data.find((d: any) => d.utrAvg);
  const wtnAvg = data.find((d: any) => d.wtnAvg);

  // Stub eventRow for drawActions/drawEntriesClick compatibility
  const eventRow = { getData: () => ({ eventId, event, eventName: event.eventName }) };

  const drawDetail = (e: any, cell: any) => {
    e.preventDefault();
    e.stopPropagation();
    const drawData = cell.getRow().getData();
    const { drawId, flightNumber, generated } = drawData;
    if (generated) {
      navigateToEvent({ eventId, drawId, renderDraw: true });
    } else {
      // Ungenerated flight — open addDraw to generate it
      const callback = (result: any) => {
        if (result.success) {
          navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
        }
      };
      (addDraw as any)({ eventId, drawId, flightNumber, callback });
    }
  };

  const columns: any[] = [
    {
      cellClick: (_: any, cell: any) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      headerSort: false,
      formatter: 'rownum',
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      width: 55,
    },
    { title: t('tables.draws.drawName'), field: DRAW_NAME, cellClick: drawDetail },
    { title: t('tables.draws.drawType'), field: DRAW_TYPE, cellClick: drawDetail },
    { title: t('tables.draws.flight'), field: 'flightNumber', width: 70, headerSort: false, hozAlign: CENTER },
    {
      title: '<i class="fa-solid fa-user-group" />',
      cellClick: drawEntriesClick(eventRow),
      field: 'entries',
      width: 50,
    },
    {
      visible: !!wtnAvg,
      field: 'wtnAvg',
      title: WTN,
      width: 80,
    },
    {
      visible: !!utrAvg,
      field: 'utrAvg',
      title: UTR,
      width: 80,
    },
  ];

  const tableEl = document.createElement('div');
  tableEl.style.cssText = 'width: 100%; background-color: var(--tmx-bg-primary);';
  target.appendChild(tableEl);

  const table = new Tabulator(tableEl, {
    headerSortElement: headerSortElement(['entries']),
    placeholder: 'No draws',
    layout: 'fitColumns',
    index: 'drawId',
    columns,
    data,
  });

  return table;
}
