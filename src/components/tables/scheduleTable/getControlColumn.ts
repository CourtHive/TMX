/**
 * Schedule table control column configuration.
 * Displays row numbers and provides header click for editing schedule notes.
 */
import { editNotes } from 'components/modals/scheduleNotes';
import { rowActions } from './scheduleRowActions';

import { CENTER } from 'constants/tmxConstants';

export function getControlColumn(): any {
  function controlTitleFormatter(cell: any): string {
    const elem = cell.getElement();
    elem.classList.add('tag');
    elem.classList.add('is-info');
    elem.classList.add('is-light');
    return `<i class="fa-regular fa-note-sticky"></i>`;
  }
  function controlColumnFormatter(cell: any): HTMLElement {
    cell.getElement().style.backgroundColor = 'var(--tmx-bg-primary)';
    const content = document.createElement('span');
    const data = cell.getRow().getData();
    content.innerHTML = data.rowNumber;
    return content;
  }

  const controlHeader = () => {
    editNotes({ notes: '', notice: '', callback: submitDetails });

    function submitDetails(result: any) {
      console.log({ result });
    }
  };

  return {
    titleFormatter: controlTitleFormatter,
    formatter: controlColumnFormatter,
    headerClick: controlHeader,
    cellClick: rowActions,
    headerSort: false,
    resizable: false,
    hozAlign: CENTER,
    frozen: true,
    width: 55
  };
}
