/**
 * Row formatter for events table with nested draws table.
 * Creates expandable rows showing draws for each event.
 */
import { mapDrawDefinition } from 'pages/tournament/tabs/eventsTab/mapDrawDefinition';
import { editAvoidances } from 'components/drawers/avoidances/editAvoidances';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { editEvent } from 'pages/tournament/tabs/eventsTab/editEvent';
import { addFlights } from 'components/modals/addFlights/addFlights';
import { eventTabDeleteDraws } from '../common/eventTabDeleteDraws';
import { deleteFlights } from 'components/modals/deleteFlights';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'components/controlBar/controlBar';
import { destroyTipster } from 'components/popovers/tipster';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { tmxToast } from 'services/notifications/tmxToast';
import { getDrawsColumns } from './getDrawsColumns';

import { LEFT, OVERLAY, NONE, RIGHT, SUB_TABLE } from 'constants/tmxConstants';

export const eventRowFormatter = (setTable: (eventId: string, table: any) => void) => (row: any) => {
  const holderEl = document.createElement('div');
  const controlEl = document.createElement('div');
  controlEl.className = 'tableControl';
  controlEl.style.marginBottom = '1em';
  const data = row.getData().drawDefs;

  holderEl.appendChild(controlEl);

  const tableEl = document.createElement('div');
  tableEl.style.backgroundColor = 'white';
  const borderStyle = '1px solid #333';
  tableEl.style.border = borderStyle;
  tableEl.style.width = '99%';

  holderEl.style.borderBottom = borderStyle;
  holderEl.style.boxSizing = 'border-box';
  holderEl.style.borderTop = borderStyle;
  holderEl.style.paddingLeft = '10px';
  holderEl.className = SUB_TABLE;
  holderEl.style.display = NONE;
  holderEl.appendChild(tableEl);

  row.getElement().appendChild(holderEl);

  const columns = getDrawsColumns(data, row);

  const drawsTable = new Tabulator(tableEl, {
    headerSortElement: headerSortElement(['entries']),
    placeholder: 'No draws',
    layout: 'fitColumns',
    index: 'drawId',
    maxHeight: 400,
    columns,
    data,
  });

  drawsTable.on('scrollVertical', destroyTipster);

  const event = row.getData().event;
  const eventId = event.eventId;
  setTable(eventId, drawsTable);

  const deleteSelectedDraws = () => {
    const selectedDraws = drawsTable.getSelectedData();
    const drawIds = selectedDraws.map(({ drawId }: any) => drawId);
    drawsTable.deselectRow();
    const callback = (result: any) => {
      if (!result.success) {
        if (result.error?.message) tmxToast({ message: result.error.message, intent: 'is-danger' });
        return;
      }

      eventTabDeleteDraws({ eventRow: row, drawsTable, drawIds });
    };
    deleteFlights({ eventId, drawIds, callback });
  };

  const flightsAdded = (result: any) => {
    if (result.generated) {
      const drawInfo = result.result?.flightProfile?.flights?.map((flight: any) => ({
        flightNumber: flight.flightNumber,
        entries: flight.drawEntries,
        drawName: flight.drawName,
        drawId: flight.drawId,
      }));
      const drawRows = drawInfo?.map((drawDefinition: any) => mapDrawDefinition(eventId)({ drawDefinition }));
      drawRows?.forEach((updatedDraw: any) => {
        drawsTable.updateOrAddData([updatedDraw]);
      });
    }
  };

  const drawAdded = (result: any) => {
    if (result.success) {
      drawsTable?.addRow(mapDrawDefinition(eventId)({ drawDefinition: result.drawDefinition }));
      const eventRow = row?.getData();
      tableEl.style.display = '';

      if (eventRow) {
        if (eventRow.matchUpsCount) {
          const matchUps = tournamentEngine.allDrawMatchUps({
            drawId: result.drawDefinition.drawId,
            inContext: false,
            eventId,
          }).matchUps;
          eventRow.matchUpsCount += matchUps?.length || 0;
          eventRow.drawsCount += 1;
        } else {
          navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
        }
      }
    }
  };

  const callback = ({ success, eventUpdates }: any) => {
    if (success) {
      const eventRow = row?.getData();
      Object.assign(eventRow.event, eventUpdates);
      row.update(eventRow);
    }
  };

  const items = [
    {
      onClick: deleteSelectedDraws,
      label: 'Delete selected',
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY,
    },
    {
      onClick: () => navigateToEvent({ eventId }),
      label: 'View entries',
      intent: 'is-info',
      location: LEFT,
    },
    {
      onClick: () => editAvoidances({ eventId }),
      id: 'editAvoidances',
      label: 'Avoidances',
      location: LEFT,
    },
    {
      onClick: () => editEvent({ event, callback }),
      label: 'Edit event',
      location: RIGHT,
    },
    {
      onClick: () => addDraw({ eventId, callback: drawAdded }),
      intent: 'is-primary',
      label: 'Add draw',
      location: RIGHT,
    },
    {
      onClick: () => addFlights({ eventId, callback: flightsAdded }),
      label: 'Add flights',
      intent: 'is-info',
      location: RIGHT,
    },
  ];
  controlBar({ table: drawsTable, target: controlEl, items });
};
