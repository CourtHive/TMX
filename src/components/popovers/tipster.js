import { renderMenu } from 'components/renderers/renderMenu';
import tippy from 'tippy.js';

let tip;

/*
 *   e.g. config: { placement: 'bottom' }
 */
export function tipster({ title, options, items, target, coords, callback, config }) {
  if (!options?.length && !items?.length) return;

  const destroy = () => {
    if (tip) {
      tip?.destroy(true);
      tip = undefined;
    }
  };

  destroy();

  const tippyMenu = document.createElement('div');

  const content = () => {
    items =
      items
        ?.filter((i) => !i.hide && !i.disabled)
        .map((i) => ({
          ...i,
          onClick: () => {
            destroy();
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
              destroy();
              o.onClick();
            } else if (typeof callback === 'function') {
              destroy();
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
