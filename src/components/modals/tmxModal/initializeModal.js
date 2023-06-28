import { TMX_MODAL } from "constants/tmxConstants";

export function initializeModal() {
  const modal = document.createElement('section');
  modal.className = 'gmodal';
  modal.ariaLabel = 'Modal';
  modal.role = 'dialog';
  modal.id = TMX_MODAL;

  modal.innerHTML = `
    <div class="gmodal__container has-center">
      <div class="gmodal__dialog">
	<div class="gmodal__header">
          <div class="gmodal__title"></div></div>
          <div class="gmodal__body"></div>
          <div class="gmodal__footer"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}