import { isFunction } from 'functions/typeOf';

export function renderButtons(target, buttons, close) {
  if (!target) return;

  const elements = {};

  for (const button of buttons || []) {
    if (!button?.label || button.hide) continue;

    const elem = document.createElement('button');
    if (button.id) {
      elements[button.id] = elem;
      elem.id = button.id;
    }

    elem.style = 'margin-right: .5em;';
    elem.className = 'button font-medium';
    if (button.intent) elem.classList.add(button.intent);
    elem.innerHTML = button.label;
    if (button.disabled) elem.disabled = true;
    elem.onclick = (e) => {
      e.stopPropagation();
      !e.target.disabled && isFunction(button.onClick) && button.onClick();
      isFunction(close) && close();
    };
    target.appendChild(elem);
  }

  return { elements };
}
