import { headerSortElement } from '../common/sorters/headerSortElement';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'courthive-components';
import { destroyTipster } from 'components/popovers/tipster';
import { getCourtColumns } from './getCourtColumns';

// constants
import { NONE, OVERLAY, RIGHT, SUB_TABLE } from 'constants/tmxConstants';
import { MODIFY_COURT } from 'constants/mutationConstants';

export const venueRowFormatter =
  (setTable: (venueId: string, table: any) => void) =>
  (row: any): void => {
    const holderEl = document.createElement('div');
    const controlEl = document.createElement('div');
    controlEl.className = 'tableControl';
    controlEl.style.marginBottom = '1em';

    const items = [
      {
        label: 'Delete selected',
        intent: 'is-danger',
        stateChange: true,
        location: OVERLAY,
      },
      {
        label: 'Add courts',
        location: RIGHT,
        align: RIGHT,
      },
    ];

    holderEl.appendChild(controlEl);

    const borderStyle = '1px solid var(--tmx-border-primary)';
    const tableEl = document.createElement('div');
    tableEl.style.backgroundColor = 'var(--tmx-bg-primary)';
    tableEl.style.border = borderStyle;
    tableEl.style.width = '99%';

    holderEl.className = SUB_TABLE;
    holderEl.style.display = NONE;
    holderEl.style.boxSizing = 'border-box';
    holderEl.style.paddingLeft = '10px';
    holderEl.style.borderTop = borderStyle;
    holderEl.style.borderBottom = borderStyle;

    holderEl.appendChild(tableEl);

    row.getElement().appendChild(holderEl);

    const columns = getCourtColumns();

    const courtsTable = new Tabulator(tableEl, {
      headerSortElement: headerSortElement([
        'courtName',
        'scheduledTime',
        'unscheduledTime',
        'floodlit',
        'surfaceType',
        'indoorOutdoor',
      ]),
      data: row.getData().courts,
      placeholder: 'No courts',
      layout: 'fitColumns',
      index: 'courtId',
      maxHeight: 400,
      columns,
    });

    const venueId = row.getData().venueId;
    setTable(venueId, courtsTable);

    controlBar({ table: courtsTable, target: controlEl, items });

    courtsTable.on('scrollVertical', destroyTipster);
    courtsTable.on('cellEdited', (cell: any) => {
      const row = cell.getRow().getData();
      const value = cell.getValue();

      if (value.length) {
        const postMutation = (result: any) => {
          if (!result.success) {
            console.log({ result });
          }
        };
        const methods = [
          { method: MODIFY_COURT, params: { courtId: row.courtId, modifications: { courtName: value } } },
        ];
        mutationRequest({ methods, callback: postMutation });
      } else {
        console.log('INVALID VALUE');
      }
    });
  };
