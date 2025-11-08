/**
 * Render modal buttons with configuration.
 * Creates button elements with intents, labels, click handlers, and disabled states.
 */
import { isFunction } from 'functions/typeOf';

export function renderButtons(target: HTMLElement, buttons: any[], close?: () => void): { elements: Record<string, HTMLElement> } {
  if (!target) return { elements: {} };

  const elements: Record<string, HTMLElement> = {};

  for (const button of buttons || []) {
    if (!button?.label || button.hide) continue;

    const elem = document.createElement('button');
    if (button.id) {
      elements[button.id] = elem;
      elem.id = button.id;
    }

    elem.style.marginRight = '.5em';
    elem.className = 'button font-medium';
    if (button.intent) elem.classList.add(button.intent);
    elem.innerHTML = button.label;
    if (button.disabled) elem.disabled = true;
    elem.onclick = (e) => {
      e.stopPropagation();
      !(e.target as HTMLButtonElement).disabled && isFunction(button.onClick) && button.onClick();
      isFunction(close) && close && close();
    };
    target.appendChild(elem);
  }

  return { elements };
}
