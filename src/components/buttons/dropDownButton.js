import { isFunction } from 'functions/typeOf';

import { RIGHT } from 'constants/tmxConstants';

const FONT_MEDIUM = 'font-medium';

export function dropDownButton({ target, button, stateChange }) {
  let i = 0;
  const genericItem = () => {
    i += 1;
    return `Item${i}`;
  };

  const elem = document.createElement('div');
  if (button.class) elem.classList.add(button.class);
  elem.classList.add('dropdown');
  if (button.id) elem.id = button.id;

  if (button.align === RIGHT) {
    elem.classList.add('is-right');
    elem.style = 'margin-left: 1em';
  } else {
    elem.style = 'margin-right: 1em';
  }
  const isActive = (e) => e.classList.contains('is-active');
  const closeDropDown = () => {
    if (isActive(elem)) {
      elem.classList.remove('is-active');
    }
  };
  const activeState = (e) => {
    if (isActive(e)) {
      e.classList.remove('is-active');
    } else {
      e.classList.add('is-active');
      return true;
    }
  };
  elem.onmouseleave = closeDropDown;
  elem.onclick = () => activeState(elem);

  const trigger = document.createElement('div');
  trigger.classList.add('dropdown-trigger');
  const ddButton = document.createElement('button');
  ddButton.className = 'button font-medium';
  if (button.intent) ddButton.classList.add(button.intent);
  ddButton.setAttribute('aria-haspopup', 'true');
  const label = document.createElement('span');
  if (isFunction(button.onClick)) label.onclick = button.onClick;
  label.style = `margin-right: 1em`;
  label.innerHTML = button.label;
  ddButton.appendChild(label);
  const icon = document.createElement('span');
  if (isFunction(button.onClick)) icon.onclick = button.onClick;
  icon.innerHTML = `
      <span class="icon is-small font-medium">
        <i class="fas fa-angle-down font-medium" aria-hidden="true"></i>
      </span>
  `;
  ddButton.appendChild(icon);
  trigger.appendChild(ddButton);
  elem.appendChild(trigger);

  const menu = document.createElement('div');
  menu.classList.add('dropdown-menu');
  menu.setAttribute('z-index', '99998');
  const content = document.createElement('div');
  content.classList.add('dropdown-content');

  const clearActive = () => {
    const items = menu.querySelectorAll('.dropdown-item');
    for (const item of Array.from(items)) {
      item.classList.remove('is-active');
    }
  };

  const createAnchor = (option) => {
    const anchor = document.createElement('a');
    anchor.className = FONT_MEDIUM;
    const opacity = option.disabled ? '0.4' : '1';
    anchor.style = `text-decoration: none; opacity: ${opacity};`;
    if (option.color) anchor.style.color = option.color;
    anchor.classList.add('dropdown-item');
    if (option.isActive) anchor.classList.add('is-active');
    if (option.value) anchor.value = option.value;
    if (option.class) {
      anchor.classList.add(option.class);
    }

    anchor.onclick = (e) => {
      if (option.disabled) return;
      if (option.value) {
        ddButton.value = option.value;
        elem.value = option.value;
      }
      e.stopPropagation();
      if (isFunction(option.onClick)) {
        if (isFunction(stateChange)) stateChange();
        option.onClick(e);
      }
      if (option.close) closeDropDown();
      const active = isActive(anchor);
      clearActive();
      if (!active) {
        if (button.selection) activeState(anchor);
        if (button.modifyLabel && option.modifyLabel !== false) {
          label.innerHTML = `${button.append ? button.label + ': ' : ''}${option?.label || genericItem()}`;
        }
      } else {
        label.innerHTML = button.label;
      }
    };
    anchor.innerHTML = option?.label || genericItem();
    return anchor;
  };

  for (const option of button.options || []) {
    if (option.heading) {
      const heading = document.createElement('div');
      heading.style = 'font-weight: bold';
      heading.classList.add('dropdown-item');
      heading.classList.add(FONT_MEDIUM);
      heading.innerHTML = option.heading;
      content.appendChild(heading);
    } else if (option.divider) {
      const item = document.createElement('hr');
      item.classList.add('dropdown-divider');
      item.classList.add(FONT_MEDIUM);
      content.appendChild(item);
    } else if (!option.hide) content.appendChild(createAnchor(option));
  }

  if (button.options?.length) {
    if (button.options[0].value) elem.value = button.options[0].value;
    menu.appendChild(content);
  }
  elem.appendChild(menu);

  if (target) target.appendChild(elem);

  return elem;
}
