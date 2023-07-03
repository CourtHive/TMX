import { mapDrawDefinition } from 'Pages/Tournament/Tabs/eventsTab/mapDrawDefinition';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'components/controlBar/controlBar';
import { destroyTipster } from 'components/popovers/tipster';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { addDraw } from 'components/drawers/addDraw';
import { getDrawsColumns } from './getDrawsColumns';

import { LEFT, OVERLAY, NONE, RIGHT, SUB_TABLE } from 'constants/tmxConstants';
import { DELETE_FLIGHT_AND_DRAW } from 'constants/mutationConstants';

export function eventRowFormatter(row) {
  const holderEl = document.createElement('div');
  const controlEl = document.createElement('div');
  controlEl.className = 'tableControl';
  controlEl.style.marginBottom = '1em';
  const data = row.getData().drawDefs;

  holderEl.appendChild(controlEl);

  const borderStyle = '1px solid #333';
  const tableEl = document.createElement('div');
  tableEl.style.display = data.length ? '' : NONE;
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

  const columns = getDrawsColumns();

  const drawsTable = new Tabulator(tableEl, {
    headerSortElement: headerSortElement(['entries']),
    placeholder: 'No draws',
    layout: 'fitColumns',
    index: 'drawId',
    maxHeight: 400,
    columns,
    data
  });

  drawsTable.on('scrollVertical', destroyTipster);

  const eventId = row.getData().eventId;

  const deleteSelectedDraws = () => {
    const selectedDraws = drawsTable.getSelectedData();
    const drawIds = selectedDraws.map(({ drawId }) => drawId);
    // const methods = [{ method: DELETE_DRAW_DEFINITIONS, params: { eventId, drawIds } }];
    const methods = drawIds.map((drawId) => ({ method: DELETE_FLIGHT_AND_DRAW, params: { eventId, drawId } }));
    const callback = (result) => {
      result.success && drawsTable.deleteRow(drawIds);
      const eventRow = row?.getData();
      if (eventRow) {
        const matchUps = tournamentEngine.allEventMatchUps({
          inContext: false,
          eventId
        }).matchUps;
        eventRow.matchUpsCount = matchUps?.length || 0; // table data is reactive!
        eventRow.drawsCount -= 1; // table data is reactive!
      }

      if (!drawsTable.getData().length) {
        tableEl.style.display = NONE;
      }
    };
    mutationRequest({ methods, callback });
  };

  const drawAdded = (result) => {
    if (result.success) {
      drawsTable?.addRow(mapDrawDefinition(eventId)(result.drawDefinition));
      const eventRow = row?.getData();
      tableEl.style.display = '';

      if (eventRow) {
        if (!eventRow.matchUpsCount) {
          navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
        } else {
          const matchUps = tournamentEngine.allDrawMatchUps({
            drawId: result.drawDefinition.drawId,
            inContext: false,
            eventId
          }).matchUps;
          eventRow.matchUpsCount += matchUps?.length || 0; // table data is reactive!
          eventRow.drawsCount += 1; // table data is reactive!
        }
      }
    }
  };

  const items = [
    {
      onClick: deleteSelectedDraws,
      label: 'Delete selected',
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY
    },
    {
      onClick: () => navigateToEvent({ eventId }),
      label: 'View entries',
      intent: 'is-info',
      location: LEFT
    },
    {
      label: 'Edit event',
      location: RIGHT
    },
    {
      onClick: () => addDraw({ eventsTableRow: row, drawsTable, eventId, callback: drawAdded }),
      intent: 'is-primary',
      label: 'Add draw',
      location: RIGHT
    }
  ];
  controlBar({ table: drawsTable, target: controlEl, items });
}
