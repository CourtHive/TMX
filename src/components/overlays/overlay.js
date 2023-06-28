import { removeAllChildNodes } from 'services/dom/transformers';

import { NONE, OVERLAY_CONTENT, TMX_OVERLAY } from 'constants/tmxConstants';

export function openOverlay({ content } = {}) {
  const overlayContent = document.getElementById(OVERLAY_CONTENT);
  if (typeof content === 'string') {
    overlayContent.innerHTML = content;
  } else if (content) {
    overlayContent.appendChild(content);
  }
  const tmxOverlay = document.getElementById(TMX_OVERLAY);
  tmxOverlay.style.display = 'block';
  const closeButton = tmxOverlay.getElementsByClassName('closebtn')?.[0];
  if (closeButton) closeButton.onclick = () => closeOverlay();
}

export function closeOverlay() {
  const overlayContent = document.getElementById(OVERLAY_CONTENT);
  removeAllChildNodes(overlayContent);
  const tmxOverlay = document.getElementById(TMX_OVERLAY);
  tmxOverlay.style.display = NONE;
}
