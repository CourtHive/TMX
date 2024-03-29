import { renderField } from './renderField';

export function renderMenu(elem, menu, close) {
  if (!elem) return;

  const aside = document.createElement('aside');
  aside.classList.add('menu');
  const inputs = {};

  const getClickAction = (item) => {
    if (close && item.close !== false) {
      return (e) => {
        e.stopPropagation();
        close();
        item.onClick();
      };
    }
    return (e) => {
      e.stopPropagation();
      item.onClick();
    };
  };

  let i = 0;
  const getIndex = () => {
    i += 1;
    return i;
  };
  const genericItem = (item) => item?.heading || item?.text || item?.label || `Item ${getIndex()}`;
  const createMenuItem = (subItem) => {
    const menuItem = document.createElement('li');
    menuItem.className = 'font-medium';
    if (subItem.style) menuItem.style = subItem.style;
    if (subItem.onClick) {
      const fontSize = subItem.fontSize || '1em';
      if (subItem.divider) {
        const item = document.createElement('hr');
        item.classList.add('dropdown-divider');
        menuItem.appendChild(item);
      } else {
        const anchor = document.createElement('a');
        const opacity = subItem.disabled ? '0.4' : '1';
        anchor.style = `text-decoration: none; opacity: ${opacity}; font-size: ${fontSize}`;
        if (subItem.class) anchor.classList.add(subItem.class);
        if (subItem.color) anchor.style.color = subItem.color;
        if (subItem.heading) anchor.style.fontWeight = 'bold';
        if (!subItem.disabled) anchor.onclick = getClickAction(subItem);
        anchor.innerHTML = genericItem(subItem);
        menuItem.appendChild(anchor);
      }
    } else {
      menuItem.innerHTML = genericItem(subItem);
      if (!subItem.disabled) menuItem.onclick = subItem.onClick;
    }
    return menuItem;
  };

  let focusElement;

  for (const item of menu || []) {
    if (item.hide) continue;
    if (item.items) {
      if (item.text) {
        const menuLabel = document.createElement('p');
        menuLabel.className = 'menu-label font-medium';
        menuLabel.innerHTML = item.text;
        aside.appendChild(menuLabel);
      }

      const menuList = document.createElement('ul');
      menuList.className = 'menu-list';
      for (const subItem of item.items) {
        if (!subItem.hide) menuList.appendChild(createMenuItem(subItem));
      }
      aside.appendChild(menuList);
    } else if (item.type === 'input') {
      const { field, inputElement } = renderField(item);
      if (item.focus) focusElement = inputElement;
      inputs[item.field] = inputElement;
      aside.appendChild(field);
    } else if (item.type === 'divider') {
      const item = document.createElement('hr');
      item.classList.add('dropdown-divider');
      aside.appendChild(item);
    }
  }

  elem.appendChild(aside);

  return { focusElement };
}
