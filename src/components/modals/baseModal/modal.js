import { removeAllChildNodes } from 'services/dom/transformers';
import { isFunction, isObject } from 'functions/typeOf';
import { lang } from 'services/translator';
import Gmodal from 'glory-modal';

import { NONE, TMX_MODAL } from 'constants/tmxConstants';
import 'styles/modal.css';

export const baseModal = () => {
  const modalId = TMX_MODAL;
  const attributes = {};
  let scrollTop;
  let closeFx;

  const closeAction = () => {
    if (isFunction(closeFx)) {
      closeFx();
      closeFx = undefined;
    }
    window.scrollTo({ top: scrollTop }); // deal with bad actors
    enableScroll();
  };

  const elem = document.getElementById(modalId);
  const modal = new Gmodal(elem);
  elem.addEventListener('gmodal:close', closeAction);

  const open = ({ title, content, buttons, onClose } = {}) => {
    disableScroll();
    closeFx = onClose;
    const noPadding = !title && !buttons;
    setTitle(title, noPadding);
    setContent(content, noPadding);
    footerButtons(buttons, noPadding);
    modal.open();
    setTimeout(() => window.scrollTo({ top: scrollTop }), 100);
  };
  const close = () => {
    // NOTE: modal.close() method causes Tabulator tables to scroll
    document.getElementById(modalId).classList.remove('is-shown');
    document.body.classList.remove('gmodal-open');
    elem.style.display = NONE;
    modal._isOpen = false;
    modal._hideBackdrop();
    Gmodal.modals.pop();
    closeAction();
    // --------------------
  };

  const setTitle = (title, noPadding) => {
    const target = document.getElementById(modalId);
    const titleElement = target.querySelector('.gmodal__title');
    const header = target.querySelector('.gmodal__header');
    header.style.padding = noPadding ? '' : '15px';
    header.style.display = title ? '' : NONE;
    removeAllChildNodes(titleElement);
    titleElement.innerHTML = title || '';
  };

  const setContent = (content, noPadding) => {
    const target = document.getElementById(modalId);
    const elem = target.querySelector('.gmodal__body');
    elem.style.padding = noPadding ? '' : '15px';
    if (!elem.classList.contains('font-medium')) elem.classList.add('font-medium');
    if (content) {
      removeAllChildNodes(elem);
      if (isFunction(content)) {
        attributes.content = content(elem);
      } else if (isObject(content)) {
        elem.appendChild(content);
      } else {
        elem.innerHTML = content;
      }
    }
  };

  const setFooter = (content, noPadding) => {
    const target = document.getElementById(modalId);
    const elem = target.querySelector('.gmodal__footer');
    elem.style.padding = noPadding ? '' : '15px';
    removeAllChildNodes(elem);
    elem.innerHTML = content;
  };

  const setOnClose = (onClose) => (closeFx = onClose);

  const defaultFooterButton = {
    label: lang.tr('tournaments.close'),
    intent: 'is-info',
    onClick: close
  };
  const okString = lang.tr('actions.ok');

  const footerButtons = (buttons, noPadding) => {
    const target = document.getElementById(modalId);
    const footerElement = target.querySelector('.gmodal__footer');
    footerElement.style.padding = noPadding ? '' : '15px';
    footerElement.style.display = buttons?.length ? '' : NONE;

    removeAllChildNodes(footerElement);
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
          if (isFunction(config.close)) {
            if (config.close()) close();
          } else {
            close();
          }
        }
      };
      footerElement.appendChild(elem);
    }
  };

  const inform = ({ message, title, okAction }) => {
    setTitle(title || 'Information');
    footerButtons([{ label: okString, onClick: okAction, close: true }]);
    setContent(message);
    modal.open();
  };

  const confirm = ({ title, query, okAction, cancelAction, okIntent }) => {
    const buttons = [
      {
        label: 'Cancel',
        intent: NONE,
        onClick: cancelAction || close,
        close: true
      },
      okAction && {
        label: okString,
        intent: okIntent || 'is-warning',
        onClick: okAction,
        close: true
      }
    ].filter(Boolean);
    footerButtons(buttons);
    setTitle(title || lang.tr('act'));
    setContent(query);
    modal.open();
  };

  return {
    footerButtons,
    attributes,
    setContent,
    setOnClose,
    setFooter,
    setTitle,
    confirm,
    inform,
    close,
    open,

    // dev access for investigations
    g: Gmodal,
    modal
  };

  function disableScroll() {
    // Get the current page scroll position
    scrollTop = window.scrollY || document.documentElement.scrollTop;
    // if any scroll is attempted, set this to the previous value
    window.onscroll = () => window.scrollTo({ top: scrollTop });
  }

  function enableScroll() {
    window.onscroll = function () {};
    return true;
  }
};
