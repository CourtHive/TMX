export function cellBorder(cell: any): HTMLDivElement {
  cell.getElement().style.border = '1px solid var(--tmx-border-primary)';
  const value = cell.getValue();
  const el = document.createElement('div');
  el.innerHTML = value || '';
  return el;
}
