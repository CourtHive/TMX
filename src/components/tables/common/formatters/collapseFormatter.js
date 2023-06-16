/*
  NOTE: column does not automatically show/hide on resize when this formatter is in use
*/

import { EMPTY_STRING, NONE } from 'constants/tmxConstants';

export function collapseFormatter(cell) {
  const el = document.createElement('div'),
    config = cell.getRow()._row.modules.responsiveLayout;

  el.classList.add('tabulator-responsive-collapse-toggle');

  el.innerHTML = `
  <span class='tabulator-responsive-collapse-toggle-open'> &#9655; </span>
  <span class='tabulator-responsive-collapse-toggle-close'> &#9661; </span>`;

  cell.getElement().classList.add('tabulator-row-handle');

  function toggleList(isOpen) {
    const collapseEl = config.element;
    config.open = isOpen;
    if (collapseEl) collapseEl.style.display = open ? EMPTY_STRING : NONE;
    el.classList[config.open ? 'add' : 'remove']('open');
  }

  el.addEventListener('click', (e) => {
    console.log('clicked');
    e.stopImmediatePropagation();
    toggleList(!config.open);
    cell.getTable().rowManager.adjustTableSize();
  });

  toggleList(config.open);

  return el;
}
