import { cModal } from 'courthive-components/src/components/modal/cmodal';
import { isFunction, isObject } from 'functions/typeOf';
import { lang } from 'services/translator';

import { NONE } from 'constants/tmxConstants';

export function closeModal() {
  cModal.close();
}
export function openModal({ title, content, buttons, onClose } = {}) {
  const noPadding = !title && !buttons;
  const config = { padding: noPadding ? '' : '.5', maxWidth: 500 };
  const footer = buttons && footerButtons(buttons);
  cModal.open({ title, content, footer, config, onClose });
}

const defaultFooterButton = {
  label: lang.tr('tournaments.close'),
  intent: 'is-info',
  onClick: cModal.close
};
const okString = lang.tr('actions.ok');

function footerButtons(buttons) {
  const footerElement = document.createElement('div');
  for (const button of buttons || [{ label: okString }]) {
    if (button.hide) continue;
    const config = Object.assign({}, defaultFooterButton);
    if (isObject(button)) Object.assign(config, button);
    const elem = document.createElement('button');

    if (config.disabled !== undefined) elem.disabled = config.disabled;
    if (config.id) elem.id = config.id;

    elem.style = 'margin-right: .5em;';
    elem.className = 'button font-medium';
    elem.classList.add(config.intent);
    elem.innerHTML = config.label || config.text;

    elem.onclick = (e) => {
      e.stopPropagation();
      if (isFunction(config.onClick)) config.onClick();
      if (config.close) {
        isFunction(config.close) ? config.close() && cModal.close() : cModal.close();
      }
    };
    footerElement.appendChild(elem);
  }
  return footerElement;
}

export function informModal({ message, title, okAction }) {
  const footer = footerButtons([{ label: okString, onClick: okAction, close: true }]);
  cModal.open({ title, content: message, footer });
}

export function confirmModal({ title, query, okAction, cancelAction, okIntent }) {
  const buttons = [
    {
      onClick: cancelAction || cModal.close,
      label: 'Cancel',
      intent: NONE,
      close: true
    },
    okAction && {
      intent: okIntent || 'is-warning',
      onClick: okAction,
      label: okString,
      close: true
    }
  ].filter(Boolean);

  const footer = footerButtons(buttons);
  cModal.open({ title: title || lang.tr('act'), content: query, footer });
}
