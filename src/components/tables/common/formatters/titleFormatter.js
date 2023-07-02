export function titleFormatter(cell) {
  const elem = document.createElement('div');
  elem.style = 'font-weight: bold';
  elem.innerHTML = cell.getValue();
  return elem;
}
