export function cellBorder(cell: any): HTMLDivElement {
  cell.getElement().style.border = '1px solid black';
  const value = cell.getValue();
  const el = document.createElement('div');
  el.innerHTML = value || '';
  return el;
}
