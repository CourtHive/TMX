/**
 * Tippy.js-based popover menu renderer.
 * Creates interactive popup menus with items, options, and callbacks.
 */
import { renderMenu } from 'courthive-components';
import { isFunction } from 'functions/typeOf';
import tippy, { Instance } from 'tippy.js';

let tip: Instance | undefined;

export function destroyTipster(target?: any): void {
  if (tip) {
    (tip as any)?.destroy(true);
    tip = undefined;
  }
  if (target?.remove) target.remove();
}

type TipsterParams = {
  title?: string;
  options?: any[];
  menuItems?: any[];
  coords?: any;
  callback?: (result: any) => void;
  config?: any;
  target?: HTMLElement;
  items?: any[];
};

export function tipster(params: TipsterParams): Instance | undefined {
  const { title, options, menuItems = [], coords, callback, config } = params;
  let { target, items } = params;
  if (!options?.length && !items?.length && !menuItems) return;

  destroyTipster();
  const tippyMenu = document.createElement('div');
  let focusElement: HTMLElement | undefined;

  const content = () => {
    items =
      items
        ?.filter((i) => !i.hide && !i.disabled)
        .map((i) => ({
          ...i,
          onClick: () => {
            destroyTipster(tippyMenu);
            if (isFunction(i.onClick)) i.onClick();
          },
        })) ||
      options
        ?.filter((o) => !o.hide && !o.disabled)
        .map((o) => ({
          text: typeof o === 'object' ? o.option : o,
          style: o.style,
          onClick: () => {
            if (o.subMenu) {
              tip!.setContent('IMPLEMENT SUB MENU');
            } else if (isFunction(o.onClick)) {
              destroyTipster(tippyMenu);
              o.onClick();
            } else if (isFunction(callback) && callback) {
              destroyTipster(tippyMenu);
              if (typeof o === 'object') {
                callback({ ...o, coords });
              } else {
                callback(o);
              }
            }
          },
        }));

    const menu = [{ text: title, items }, ...menuItems];
    const result = (renderMenu as any)(tippyMenu, menu);
    focusElement = result.focusElement;

    return tippyMenu;
  };

  target = target || coords?.evt?.target;
  if (target) {
    tip = tippy(target, {
      content,
      theme: 'light-border',
      trigger: 'click',
      onShown: () => {
        if (focusElement) {
          setTimeout(() => focusElement?.focus(), 0);
        }
      },
      ...config,
    });
    tip.show();
    tip.setProps({ interactive: true });
  }

  return tip;
}
