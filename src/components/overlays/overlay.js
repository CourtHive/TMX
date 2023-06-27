import { removeAllChildNodes } from 'services/dom/transformers';

import { NONE, OVERLAY_CONTENT, TMX_OVERLAY } from 'constants/tmxConstants';

export function openOverlay({ content }) {
  const overlayContent = document.getElementById(OVERLAY_CONTENT);
  if (typeof content === 'string') {
    overlayContent.innerHTML = content;
  } else {
    overlayContent.appendChild(content);
  }
  const tmxOverlay = document.getElementById(TMX_OVERLAY);
  tmxOverlay.style.display = '';
}

export function closeOverlay() {
  const tmxOverlay = document.getElementById(TMX_OVERLAY);
  removeAllChildNodes(tmxOverlay);
  tmxOverlay.style.display = NONE;
}
