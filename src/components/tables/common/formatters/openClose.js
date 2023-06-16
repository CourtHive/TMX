import { closedFilled, openedFilled } from 'assets/specialCharacters/openClose';

import { IS_OPEN, NONE, SUB_TABLE } from 'constants/tmxConstants';

const closeAction = ` <span class='tabulator-responsive-collapse-toggle-close toggleCaret'> ${openedFilled} </span>`;
const openAction = `<span class='tabulator-responsive-collapse-toggle-open toggleCaret'> ${closedFilled} </span>`;

const subTableClass = SUB_TABLE;

export function toggleOpenClose(e, cell) {
  const row = cell.getRow();
  const targetCell = row.getCells().find((cell) => cell.getColumn().getDefinition().field === IS_OPEN);
  const subTableElement = row._row.element.getElementsByClassName(subTableClass)[0];
  if (subTableElement) {
    const visible = subTableElement.style.display !== NONE;
    subTableElement.style.display = visible ? NONE : '';

    const cellElement = targetCell._cell.element;
    if (cellElement) {
      cellElement.innerHTML = visible ? openAction : closeAction;
    }
  }
}

export function openClose(cell) {
  const row = cell.getRow();
  const subTableElement = row._row.element.getElementsByClassName(subTableClass)[0];
  const visible = subTableElement?.style.display !== NONE;
  return visible ? openAction : closeAction;
}
