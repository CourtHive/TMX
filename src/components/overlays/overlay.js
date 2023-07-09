import { removeAllChildNodes } from 'services/dom/transformers';

import { NONE, TMX_OVERLAY } from 'constants/tmxConstants';

let scrollTop;

export function openOverlay({ title, content, footer } = {}) {
  if (!content || !footer) return;

  const tmxOverlay = document.getElementById(TMX_OVERLAY);
  tmxOverlay && removeAllChildNodes(tmxOverlay);

  const overlay = document.createElement('div');
  overlay.className = 'overlay noselect';
  overlay.id = TMX_OVERLAY;

  const overlayContainer = document.createElement('div');
  overlayContainer.className = 'overlay-center-align';
  overlay.appendChild(overlayContainer);

  const overlayRoot = document.createElement('div');
  overlayRoot.className = 'overlay-root';
  overlayContainer.appendChild(overlayRoot);

  if (title) {
    const header = overlayHeader({ title });
    overlayRoot.appendChild(header);
  }

  const overlayContent = document.createElement('div');
  overlayContent.className = 'overlay-content';

  if (typeof content === 'string') {
    overlayContent.innerHTML = content;
  } else if (content) {
    overlayContent.appendChild(content);
  }

  overlayRoot.appendChild(overlayContent);

  const overlayFooter = document.createElement('div');
  overlayFooter.className = 'overlay-footer';
  if (typeof footer === 'string') {
    overlayFooter.innerHTML = footer;
  } else if (footer) {
    overlayFooter.appendChild(footer);
  }
  overlayRoot.appendChild(overlayFooter);

  document.body.appendChild(overlay);

  scrollTop = window.scrollY || document.documentElement.scrollTop;
  const root = document.getElementById('root');
  root.style.display = NONE;
}

export function setOverlayContent({ content }) {
  const contentElement = document.getElementById(TMX_OVERLAY)?.getElementsByClassName('overlay-content')?.[0];
  if (contentElement) {
    removeAllChildNodes(contentElement);
    if (typeof content === 'string') {
      contentElement.innerHTML = content;
    } else if (content) {
      contentElement.appendChild(content);
    }
  }
}

function overlayHeader({ title }) {
  const header = document.createElement('h2');
  header.className = 'overlay-header';
  header.innerHTML = `
    <div class="overlay-header-content">
      <h1 class="overlay-title">${title}</h1> 
    </div>
  `;
  return header;
}

export function closeOverlay() {
  const root = document.getElementById('root');
  root.style.display = 'inline';
  window.scrollTo({ top: scrollTop });

  let tmxOverlay = document.getElementById(TMX_OVERLAY);
  removeAllChildNodes(tmxOverlay);
  let iterations = 0;

  while (iterations < 5 && tmxOverlay) {
    tmxOverlay.remove();
    iterations += 1;
    tmxOverlay = document.getElementById(TMX_OVERLAY);
  }
}
