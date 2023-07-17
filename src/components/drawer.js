import { removeAllChildNodes } from 'services/dom/transformers';
import { isFunction } from 'functions/typeOf';
import * as focusTrap from 'focus-trap';
import 'styles/drawer.css';

import { LEFT, RIGHT, TMX_DRAWER } from 'constants/tmxConstants';

export const drawer = () => {
  const settings = {
    selectorTrigger: '[data-drawer-trigger]',
    selectorTarget: '[data-drawer-target]',
    selectorClose: '[data-drawer-close]',
    leftAlignment: 'drawer--left',
    visibleClass: 'is-visible',
    activeClass: 'is-active',
    speedClose: 350,
    speedOpen: 50
  };

  const attributes = {};
  let drawerIsOpen = false,
    cancelClose,
    closeFx;

  const drawerId = TMX_DRAWER;
  let trap;

  const setOnClose = (onClose) => (closeFx = onClose);

  const close = () => {
    isFunction(closeFx) && closeFx() && (closeFx = undefined);
    const target = document.getElementById(drawerId);
    target.classList.remove(settings.visibleClass);
    document.documentElement.style.overflow = '';
    setTimeout(function () {
      if (cancelClose) {
        target.classList.add(settings.visibleClass);
        document.documentElement.style.overflow = 'hidden';
        if (isFunction(cancelClose?.callback)) {
          cancelClose.callback();
        }
      } else {
        target.classList.remove(settings.activeClass);
        drawerIsOpen = false;
      }

      cancelClose = false;
      trap?.deactivate();
    }, settings.speedClose);
  };

  const openLeft = (callback) => {
    if (!drawerId) return;
    const target = document.getElementById(drawerId);
    if (!target.classList.contains(settings.leftAlignment)) target.classList.add(settings.leftAlignment);
    openDrawer(target, callback);
  };

  const openRight = (callback) => {
    const target = document.getElementById(drawerId);
    target.classList.remove(settings.leftAlignment);
    openDrawer(target, callback);
  };

  const setTitle = (title) => {
    const target = document.getElementById(drawerId);
    const titleElement = target.querySelector('.drawer__title');
    if (titleElement) titleElement.innerHTML = title;
  };

  const setFooter = (footer) => {
    const target = document.getElementById(drawerId);
    const footerElement = target.querySelector('.drawer__footer');
    if (footerElement) {
      removeAllChildNodes(footerElement);
      if (isFunction(footer)) {
        attributes.footer = footer(footerElement, close);
      } else {
        footerElement.innerHTML = footer;
      }
    }
  };

  const setContent = (content) => {
    const target = document.getElementById(drawerId);
    const contentElement = target.querySelector('.drawer__content');
    if (contentElement) {
      removeAllChildNodes(contentElement);
      if (isFunction(content)) {
        attributes.content = content(contentElement, close);
      } else {
        contentElement.innerHTML = content;
      }
    }
  };

  const setWidth = (width) => {
    const target = document.getElementById(drawerId);
    const wrapper = target.querySelector('.drawer__wrapper');
    wrapper.style.width = width;
  };

  const openDrawer = (target, callback) => {
    drawerIsOpen = true;
    target.classList.add(settings.activeClass);
    document.documentElement.style.overflow = 'hidden';
    trap = focusTrap.createFocusTrap(target);
    trap.activate();

    if (isFunction(callback)) callback();

    setTimeout(function () {
      target.classList.add(settings.visibleClass);
    }, settings.speedOpen);
  };

  const open = ({ title, content, side, width, footer, callback, onClose } = {}) => {
    if (content) setContent(content);
    if (onClose) setOnClose(onClose);
    if (footer) setFooter(footer);
    if (title) setTitle(title);
    if (width) setWidth(width);
    if (drawerIsOpen) {
      cancelClose = { callback };
    } else {
      if (side) {
        if (side === RIGHT) return openRight(callback);
        if (side === LEFT) return openLeft(callback);
      } else {
        const target = document.getElementById(drawerId);
        openDrawer(target, callback);
      }
    }
  };

  const isDescendant = function (parent, child) {
    let node = child.parentNode;
    while (node) {
      if (node === parent) return true;
      node = node.parentNode;
    }

    return false;
  };

  const clickHandler = function (event) {
    if (!drawerId) return;
    const target = event.target;
    const parent = document.querySelector('.drawer__wrapper');
    if (!isDescendant(parent, target) || target.classList.contains('drawer__close')) close();
  };

  const keydownHandler = function (event) {
    if (event.key === 'Escape' || event.keyCode === 27) close();
  };

  document.addEventListener('click', clickHandler, false);
  document.addEventListener('keydown', keydownHandler, false);

  return { settings, open, close, setTitle, setContent, setFooter, attributes };
};
