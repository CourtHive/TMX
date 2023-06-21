import tippy from 'tippy.js';

/*
import { cva } from 'cva';

const button = cva('button', {
  variants: {
    intent: {
      primary: ['is-info'],
      secondary: ['is-success']
    },
    size: {
      medium: ['font-medium']
    }
  },
  compoundVariants: [{ intent: 'primary', size: 'medium', class: 'uppercase' }],
  defaultVariants: {
    intent: 'primary',
    size: 'medium'
  }
});
*/

import { NONE } from 'constants/tmxConstants';

export function barButton(itemConfig) {
  const elem = document.createElement('button');
  // elem.className = button({ intent: 'primary' });
  elem.className = 'button font-medium';
  if (itemConfig.id) elem.id = itemConfig.id;
  elem.style = 'margin-right: .5em;';
  if (itemConfig.visible === false) elem.style.display = NONE;
  if (itemConfig.intent) elem.classList.add(itemConfig.intent);
  if (itemConfig.toolTip?.content) tippy(elem, itemConfig.toolTip);
  elem.innerHTML = itemConfig.label;

  return elem;
}
