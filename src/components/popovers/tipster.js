import { renderMenu } from 'components/renderers/renderMenu';
import { isFunction } from 'functions/typeOf';
import tippy from 'tippy.js';

let tip;

// useful when tip appears on table row that could scroll out of view
export function destroyTipster(target) {
  if (tip) {
    tip?.destroy(true);
    tip = undefined;
  }
  if (target?.remove) target.remove();
}

/*
 *   e.g. config: { placement: 'bottom' }
 */
export function tipster(params) {
  const { title, options, menuItems = [], coords, callback, config } = params;
  let { target, items } = params;
  if (!options?.length && !items?.length && !menuItems) return;

  destroyTipster();
  const tippyMenu = document.createElement('div');

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
              tip.setContent('IMPLEMENT SUB MENU');
            } else if (isFunction(o.onClick)) {
              destroyTipster(tippyMenu);
              o.onClick();
            } else if (isFunction(callback)) {
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
    const { focusElement } = renderMenu(tippyMenu, menu);
    if (focusElement) focusElement.focus();

    return tippyMenu;
  };

  target = target || coords?.evt?.target;
  if (target) {
    tip = tippy(target, { content, theme: 'light-border', trigger: 'click', ...config });
    tip.show();
    // must be programmatic after show() event
    tip.setProps({ interactive: true });
  }

  return tip;
}
