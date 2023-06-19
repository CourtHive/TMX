import { renderMenu } from 'components/renderers/renderMenu';
import tippy from 'tippy.js';

let tip;

// useful when tip appears on table row that could scroll out of view
export function destroyTipster() {
  if (tip) {
    tip?.destroy(true);
    tip = undefined;
  }
}

/*
 *   e.g. config: { placement: 'bottom' }
 */
export function tipster({ title, options, items, target, coords, callback, config }) {
  if (!options?.length && !items?.length) return;

  destroyTipster();

  const tippyMenu = document.createElement('div');

  const content = () => {
    items =
      items
        ?.filter((i) => !i.hide && !i.disabled)
        .map((i) => ({
          ...i,
          onClick: () => {
            destroyTipster();
            if (typeof i.onClick === 'function') i.onClick();
          }
        })) ||
      options
        ?.filter((o) => !o.hide && !o.disabled)
        .map((o) => ({
          text: typeof o === 'object' ? o.option : o,
          onClick: () => {
            if (o.subMenu) {
              tip.setContent('IMPLEMENT SUB MENU');
            } else if (typeof o.onClick === 'function') {
              destroyTipster();
              o.onClick();
            } else if (typeof callback === 'function') {
              destroyTipster();
              if (typeof o === 'object') {
                callback({ ...o, coords });
              } else {
                callback(o);
              }
            }
          }
        }));

    const menu = [{ text: title, items }];
    renderMenu(tippyMenu, menu);
    return tippyMenu;
  };

  target = target || coords?.evt?.target;
  if (target) {
    tip = tippy(target, { content, theme: 'light-border', trigger: 'click', ...config });
    tip.show();
    // must be programmatic after show() event
    tip.setProps({ interactive: true });
  }
}
