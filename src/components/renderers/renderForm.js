import { renderField } from './renderField';

export function renderForm(elem, items) {
  const div = document.createElement('div');
  div.style = 'display: flex; width: 100%;';
  div.classList.add('flexcol');

  const inputs = {};

  for (const item of items) {
    if ((item.text || item.html) && !item.field) {
      const text = document.createElement('div');
      text.className = 'content';
      text.innerHTML = item.text;
      div.appendChild(text);
    }
    if (item.divider) {
      const item = document.createElement('hr');
      item.classList.add('dropdown-divider');
      div.appendChild(item);
    }
    if ((!item.label && !item.field) || item.hide) continue;

    if (item.field) {
      const { field, inputElement } = renderField(item);
      inputs[item.field] = inputElement;
      div.appendChild(field);
    }
  }
  elem.appendChild(div);

  return inputs;
}
