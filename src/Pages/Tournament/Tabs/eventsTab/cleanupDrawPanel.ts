import { removeAllChildNodes } from 'services/dom/transformers';

import { DRAW_CONTROL, DRAW_RIGHT, DRAW_LEFT } from 'constants/tmxConstants';

export function cleanupDrawPanel() {
  [DRAW_CONTROL, DRAW_RIGHT, DRAW_LEFT].forEach((elem) => {
    const element = document.getElementById(elem);
    if (element) removeAllChildNodes(element);
  });
}
