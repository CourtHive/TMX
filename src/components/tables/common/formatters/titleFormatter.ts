export function titleFormatter(cell: any): HTMLDivElement {
  const elem = document.createElement('div');
  elem.style.fontWeight = 'bold';
  elem.innerHTML = cell.getValue();
  return elem;
}
