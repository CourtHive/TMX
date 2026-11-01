/**
 * Render a table of all draws for an event.
 * Shown when multiple draws exist and no specific draw is selected.
 * Includes ungenerated flights which are clickable to generate draws.
 * Returns the Tabulator instance for control bar integration.
 */
import { formatDrawTypeLabel } from 'pages/tournament/tabs/eventsTab/describeDrawType';
import { headerSortElement } from 'components/tables/common/sorters/headerSortElement';
import { mapDrawDefinition } from 'pages/tournament/tabs/eventsTab/mapDrawDefinition';
import { drawEntriesClick } from 'components/tables/eventsTable/drawEntriesClick';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { tournamentEngine } from 'services/factory/engine';
import { tipster } from 'components/popovers/tipster';
import { t } from 'i18n';
import {
  buildDrawOrderMethod,
  canReorderDraws,
  moveDrawId,
  sortByDrawOrder,
  type MoveDirection,
} from 'functions/drawOrder';

import { BOTTOM, CENTER, DRAW_NAME, DRAW_TYPE, LEFT, RIGHT, UTR, WTN } from 'constants/tmxConstants';

// focusable, so the actions open from the keyboard as well as by click or touch
const drawActionsButton = (): string =>
  `<button type="button" class="tmx-draw-row-actions" aria-label="${t('tables.draws.drawActions')}" ` +
  `style="background: none; border: none; padding: 0 0.4em; cursor: pointer; color: var(--tmx-text-primary);">` +
  "<i class='fa fa-ellipsis-vertical'></i></button>";

export function renderDrawsTable({ eventId, target }: { eventId: string; target: HTMLElement }): any {
  const event = tournamentEngine.q.event({ eventId });
  if (!event) return;

  const data = buildDrawRows(eventId);
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

  const reorderable = canReorderDraws(data.map(({ drawId }: any) => drawId));
  let table: any;

  // the order the table shows, which is the order the user sees and moves
  const displayedDrawIds = (): string[] => table.getRows('active').map((row: any) => row.getData().drawId);

  const writeOrder = (drawIds: string[]) => {
    const refresh = () => {
      table.clearSort();
      table.replaceData(buildDrawRows(eventId));
    };
    // on failure the engine is unchanged, so the refresh puts the rows back where they were
    mutationRequest({ methods: [buildDrawOrderMethod({ eventId, drawIds })], callback: refresh });
  };

  const moveDraw = (drawId: string, direction: MoveDirection) => {
    const drawIds = moveDrawId({ drawIds: displayedDrawIds(), drawId, direction });
    if (drawIds) writeOrder(drawIds);
  };

  const drawRowActions = (e: MouseEvent, cell: any) => {
    e.stopPropagation();
    const target = (e.target as HTMLElement).closest('.tmx-draw-row-actions') as HTMLElement;
    const { drawId } = cell.getRow().getData();
    const drawIds = displayedDrawIds();
    const items = [
      moveDrawId({ drawIds, drawId, direction: 'up' }) && {
        onClick: () => moveDraw(drawId, 'up'),
        text: t('tables.draws.moveUp'),
      },
      moveDrawId({ drawIds, drawId, direction: 'down' }) && {
        onClick: () => moveDraw(drawId, 'down'),
        text: t('tables.draws.moveDown'),
      },
    ].filter(Boolean);
    tipster({ items, target: target || (e.target as HTMLElement), config: { placement: BOTTOM } });
  };

  const columns: any[] = [
    {
      visible: reorderable,
      formatter: 'handle',
      tooltip: t('tables.draws.dragToReorder'),
      headerSort: false,
      responsive: false,
      rowHandle: true,
      frozen: true,
      minWidth: 30,
      width: 30,
    },
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
    {
      title: t('tables.draws.drawType'),
      field: DRAW_TYPE,
      // Composite-aware label (e.g. "Single Elimination (Round Robin Qualifying)");
      // falls back to a title-cased raw drawType for rows without a precomputed label.
      formatter: (cell: any) => cell.getData()?.drawTypeLabel ?? formatDrawTypeLabel(cell.getValue()),
      cellClick: drawDetail,
    },
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
    {
      visible: reorderable,
      cellClick: drawRowActions,
      formatter: drawActionsButton,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 50,
    },
  ];

  const tableEl = document.createElement('div');
  tableEl.style.cssText = 'width: 100%; background-color: var(--tmx-bg-primary);';
  target.appendChild(tableEl);

  table = new Tabulator(tableEl, {
    headerSortElement: headerSortElement(['entries']),
    placeholder: t('eventRow.noDraws'),
    movableRows: reorderable,
    layout: 'fitColumns',
    index: 'drawId',
    columns,
    data,
  });
  if (reorderable) table.on('rowMoved', () => writeOrder(displayedDrawIds()));

  return table;
}

/** The event's draws and the flights that have no draw yet, in draw order. */
function buildDrawRows(eventId: string): any[] {
  const event = tournamentEngine.q.event({ eventId });
  if (!event) return [];
  const { drawDefinitions = [] } = event;

  // Collect ungenerated flights from flight profile extension
  const ungeneratedFlights: any[] = [];
  const flightProfile = tournamentEngine.q.flightProfile({ event });
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
  const generatedData = drawDefinitions.map((dd: any) =>
    mapDrawDefinition(eventId)({ drawDefinition: dd, scaleValues }),
  );
  return sortByDrawOrder({ items: [...generatedData, ...ungeneratedFlights], event, flightProfile });
}
