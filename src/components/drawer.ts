/**
 * Drawer component for side panels.
 * Supports left/right positioning, focus trap, and dynamic content/footer rendering.
 */
import { removeAllChildNodes } from 'services/dom/transformers';
import { isFunction } from 'functions/typeOf';
import * as focusTrap from 'focus-trap';
import 'styles/drawer.css';

import { LEFT, RIGHT, TMX_DRAWER } from 'constants/tmxConstants';

export const drawer = (): any => {
  const settings = {
    selectorTrigger: '[data-drawer-trigger]',
    selectorTarget: '[data-drawer-target]',
    selectorClose: '[data-drawer-close]',
    leftAlignment: 'drawer--left',
    visibleClass: 'is-visible',
    activeClass: 'is-active',
    speedClose: 350,
    speedOpen: 50,
  };

  const attributes: any = {};
  let drawerIsOpen = false;
  let cancelClose: any;
  let closeFx: (() => boolean | void) | undefined;

  const drawerId = TMX_DRAWER;
  let trap: any;

  const setOnClose = (onClose: () => boolean | void) => (closeFx = onClose);

  const close = () => {
    isFunction(closeFx) && closeFx && closeFx() && (closeFx = undefined);
    const target = document.getElementById(drawerId);
    if (!target) return;
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

  const openLeft = (callback?: () => void) => {
    if (!drawerId) return;
    const target = document.getElementById(drawerId);
    if (!target) return;
    if (!target.classList.contains(settings.leftAlignment)) target.classList.add(settings.leftAlignment);
    openDrawer(target, false, callback);
  };

  const openRight = (callback?: () => void) => {
    const target = document.getElementById(drawerId);
    if (!target) return;
    target.classList.remove(settings.leftAlignment);
    openDrawer(target, false, callback);
  };

  const setTitle = (title: string) => {
    const target = document.getElementById(drawerId);
    const titleElement = target?.querySelector('.drawer__title');
    if (titleElement) titleElement.innerHTML = title;
  };

  const setFooter = (footer?: string | ((elem: HTMLElement, close: () => void) => any)) => {
    const target = document.getElementById(drawerId);
    const footerElement = target?.querySelector('.drawer__footer') as HTMLElement;
    if (footerElement) {
      removeAllChildNodes(footerElement);
      if (isFunction(footer)) {
        attributes.footer = (footer as any)(footerElement, close);
      } else {
        footerElement.innerHTML = (footer as string) || '';
      }
    }
  };

  const setContent = (content: string | ((elem: HTMLElement, close: () => void) => any)) => {
    const target = document.getElementById(drawerId);
    const contentElement = target?.querySelector('.drawer__content') as HTMLElement;
    if (contentElement) {
      removeAllChildNodes(contentElement);
      if (isFunction(content)) {
        attributes.content = (content as any)(contentElement, close);
      } else {
        contentElement.innerHTML = content as string;
      }
    }
  };

  const setWidth = (width: string) => {
    const target = document.getElementById(drawerId);
    const wrapper = target?.querySelector('.drawer__wrapper') as HTMLElement;
    if (wrapper) wrapper.style.width = width;
  };

  const openDrawer = (target: HTMLElement, footer: boolean, callback?: () => void) => {
    drawerIsOpen = true;
    target.classList.add(settings.activeClass);
    document.documentElement.style.overflow = 'hidden';
    if (footer) {
      trap = focusTrap.createFocusTrap(target);
      trap.activate();
    }

    if (isFunction(callback) && callback) callback();

    setTimeout(function () {
      target.classList.add(settings.visibleClass);
    }, settings.speedOpen);
  };

  const open = ({
    title,
    content,
    side,
    width,
    footer,
    callback,
    onClose,
  }: {
    title?: string;
    content?: any;
    side?: string;
    width?: string;
    footer?: any;
    callback?: () => void;
    onClose?: () => boolean | void;
  } = {}) => {
    if (content) setContent(content);
    if (onClose) setOnClose(onClose);
    if (title) setTitle(title);
    if (width) setWidth(width);
    setFooter(footer);
    if (drawerIsOpen) {
      cancelClose = { callback };
    } else if (side) {
      if (side === RIGHT) return openRight(callback);
      if (side === LEFT) return openLeft(callback);
    } else {
      const target = document.getElementById(drawerId);
      if (target) openDrawer(target, footer as any, callback);
    }
  };

  const isDescendant = function (parent: HTMLElement, child: HTMLElement): boolean {
    let node = child.parentNode as HTMLElement;
    while (node) {
      if (node === parent) return true;
      node = node.parentNode as HTMLElement;
    }

    return false;
  };

  const clickHandler = function (pointerEvent: MouseEvent) {
    if (!drawerId) return;
    const target = pointerEvent.target as HTMLElement;
    const parent = document.querySelector('.drawer__wrapper') as HTMLElement;
    if (!isDescendant(parent, target) || target.classList.contains('drawer__close')) close();
  };

  const keydownHandler = (keyEvent: KeyboardEvent) => {
    if (keyEvent.key === 'Escape') close();
  };

  document.addEventListener('click', clickHandler, false);
  document.addEventListener('keydown', keydownHandler, false);

  return { settings, open, close, setTitle, setContent, setFooter, attributes };
};
