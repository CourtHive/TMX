export function cellBorder(cell) {
  cell.getElement().style.border = '1px solid black';
  const value = cell.getValue();
  const el = document.createElement('div');
  el.innerHTML = value || '';
  return el;
}
