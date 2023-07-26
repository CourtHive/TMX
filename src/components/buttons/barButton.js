import tippy from 'tippy.js';

import { NONE, RIGHT } from 'constants/tmxConstants';

export function barButton(itemConfig) {
  const elem = document.createElement('button');
  elem.className = 'button font-medium';
  if (itemConfig.disabled) elem.disabled = true;
  if (itemConfig.class) elem.classList.add(itemConfig.class);
  if (itemConfig.id) elem.id = itemConfig.id;

  if (itemConfig.location === RIGHT) {
    elem.style = 'margin-left: 1em';
  } else {
    elem.style = 'margin-right: 1em';
  }

  if (itemConfig.intent) elem.classList.add(itemConfig.intent);
  if (itemConfig.toolTip?.content) tippy(elem, itemConfig.toolTip);
  elem.innerHTML = itemConfig.label;

  if (itemConfig.visible === false) {
    elem.style.display = NONE;
  }

  return elem;
}
