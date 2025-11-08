import { closedFilled, openedFilled } from 'assets/specialCharacters/openClose';

import { IS_OPEN, NONE, SUB_TABLE } from 'constants/tmxConstants';

const closeAction = ` <span class='tabulator-responsive-collapse-toggle-close toggleCaret'> ${openedFilled} </span>`;
const openAction = `<span class='tabulator-responsive-collapse-toggle-open toggleCaret'> ${closedFilled} </span>`;

const subTableClass = SUB_TABLE;

export function toggleOpenClose(_e: any, cell: any): { open: boolean } | undefined {
  const row = cell.getRow();
  const subTableElement = row._row.element.getElementsByClassName(subTableClass)[0] as HTMLElement;
  if (subTableElement) {
    const visible = subTableElement.style.display !== NONE;
    subTableElement.style.display = visible ? NONE : '';

    const targetCell = row.getCells().find((cell: any) => cell.getColumn().getDefinition().field === IS_OPEN);
    const cellElement = targetCell?._cell?.element;
    if (cellElement) cellElement.innerHTML = visible ? openAction : closeAction;
    return { open: !visible };
  }
  return undefined;
}

export function openClose(cell: any): string {
  const row = cell.getRow();
  const subTableElement = row._row.element.getElementsByClassName(subTableClass)[0] as HTMLElement;
  const visible = subTableElement?.style.display !== NONE;
  return visible ? openAction : closeAction;
}
