/**
 * Tippy.js-based popover menu renderer.
 * Creates interactive popup menus with items, options, and callbacks.
 */
import { renderMenu } from 'courthive-components';
import { isFunction } from 'functions/typeOf';
import tippy, { Instance } from 'tippy.js';

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

class TipsterManager {
  private instance: Instance | undefined;

  destroy = (target?: any): void => {
    if (this.instance) {
      (this.instance as any)?.destroy(true);
      this.instance = undefined;
    }
    if (target?.remove) target.remove();
  };

  create = (params: TipsterParams): Instance | undefined => {
    const { title, options, menuItems = [], coords, callback, config } = params;
    let { target, items } = params;
    if (!options?.length && !items?.length && !menuItems) return;

    this.destroy();
    const tippyMenu = document.createElement('div');
    let focusElement: HTMLElement | undefined;

    const content = () => {
      items =
        items
          ?.filter((i) => !i.hide && !i.disabled)
          .map((i) => ({
            ...i,
            onClick: () => {
              this.destroy(tippyMenu);
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
                this.instance!.setContent('IMPLEMENT SUB MENU');
              } else if (isFunction(o.onClick)) {
                this.destroy(tippyMenu);
                o.onClick();
              } else if (isFunction(callback) && callback) {
                this.destroy(tippyMenu);
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
      this.instance = tippy(target, {
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
      this.instance.show();
      this.instance.setProps({ interactive: true });
    }

    return this.instance;
  };
}

const tipsterManager = new TipsterManager();

export const tipster = tipsterManager.create;
export const destroyTipster = tipsterManager.destroy;
