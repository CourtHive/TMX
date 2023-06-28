import { NONE, TMX_OVERLAY } from 'constants/tmxConstants';

let scrollTop;

export function openOverlay({ title, content, footer } = {}) {
  if (!content || !footer) return;

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
  // const close = document.getElementById('closeOverlay');
  // close.onclick = closeOverlay;
  const root = document.getElementById('root');
  root.style.display = NONE;
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
  const tmxOverlay = document.getElementById(TMX_OVERLAY);
  tmxOverlay.remove();
}
