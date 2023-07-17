import { createTypeAhead } from 'services/dom/createTypeAhead';
import { Datepicker } from 'vanillajs-datepicker';
import { isFunction } from 'functions/typeOf';
import { validator } from './renderValidator';

import { NONE } from 'constants/tmxConstants';

export function renderOptions(select, item) {
  for (const option of item.options) {
    if (option.hide) continue;
    const opt = document.createElement('option');
    opt.className = 'font-medium';
    if (option.value) opt.setAttribute('value', option.value);
    if (option.selected || item.value === option.value) opt.setAttribute('selected', 'true');
    opt.innerHTML = option.label;
    select.appendChild(opt);
  }
}

export function renderField(item) {
  const field = document.createElement('div');
  field.className = 'field font-medium';

  if (item.width) {
    field.style = `width: ${item.width}`;
  } else {
    field.style = 'flex-grow: 1';
  }

  if (item.label && !item.checkbox) {
    const label = document.createElement('label');
    label.style = 'font-weight: bold; font-size: larger;';
    label.innerHTML = item.label;
    field.appendChild(label);
  }

  let inputElement, datepicker;

  const control = document.createElement('div');
  control.className = 'control font-medium';

  if (item.text) {
    const div = document.createElement('div');
    if (item.id) div.id = item.id;
    div.className = 'content';
    div.innerHTML = item.text;
    control.appendChild(div);
  } else if (item.options) {
    const div = document.createElement('div');
    div.className = 'select font-medium';
    div.style = 'width: 100%';
    const select = document.createElement('select');
    select.style = 'width: 100%';
    renderOptions(select, item);
    div.appendChild(select);
    control.appendChild(div);

    if (item.help) {
      const help = document.createElement('p');
      help.className = 'help font-medium is-info';
      help.innerHTML = item.help?.text;
      help.style.display = item.help?.visible ? '' : NONE;
      control.appendChild(help);
    }

    inputElement = select;
    if (isFunction(item.onChange)) select.addEventListener('change', (e) => item.onChange(e, item));
  } else if (item.checkbox) {
    const div = document.createElement('div');
    div.className = 'field';
    const input = document.createElement('input');
    inputElement = input;
    input.className = 'is-checkradio is-success';
    input.type = 'checkbox';
    input.id = item.id;
    div.appendChild(input);
    const label = document.createElement('label');
    label.setAttribute('for', item.id);
    label.innerHTML = item.label;
    div.appendChild(label);
    control.appendChild(div);
  } else {
    const input = document.createElement('input');
    input.className = 'input font-medium';
    if (item.class) input.classList.add(item.class);
    input.setAttribute('type', item.type || 'text');
    input.setAttribute('autocomplete', item.autocomplete || 'cc-number');
    input.setAttribute('placeholder', item.placeholder || '');
    if (item.id) input.setAttribute('id', item.id);
    control.appendChild(input);
    if (item.iconLeft) {
      control.classList.add('has-icons-left');
      const span = document.createElement('span');
      span.className = 'icon is-small is-left font-medium';
      const icon = document.createElement('i');
      icon.className = item.iconLeft;
      span.appendChild(icon);
      control.appendChild(span);
    }
    if (item.type === 'password') {
      control.classList.add('has-icons-right');
      const span = document.createElement('span');
      span.className = 'icon is-small is-right font-medium';
      const icon = document.createElement('i');
      icon.className = item.iconRight;
      span.appendChild(icon);
      control.appendChild(span);
    }
    inputElement = input;
    const help = document.createElement('p');
    help.className = 'help font-medium';
    control.appendChild(help);
    if (item.validator) {
      input.addEventListener('input', (e) => validator(item, e, input, help, item.validator));
    }
    if (item.date) {
      datepicker = new Datepicker(inputElement, {
        // ...options
        format: 'yyyy-mm-dd',
        autohide: true
      });
    } else if (item.typeAhead) {
      createTypeAhead({ ...item.typeAhead, element: input });
    } else {
      if (isFunction(item.onKeyDown)) input.addEventListener('keydown', (e) => item.onKeyDown(e, item));
      if (isFunction(item.onChange)) input.addEventListener('change', (e) => item.onChange(e, item));
      if (isFunction(item.onInput)) input.addEventListener('input', (e) => item.onInput(e, item));
      if (isFunction(item.onKeyUp)) input.addEventListener('keyup', (e) => item.onKeyUp(e, item));
      if (item.value !== undefined) input.value = item.value;
    }
  }

  field.appendChild(control);
  if (item.visible === false) {
    field.style.display = NONE;
  }

  return { field, inputElement, datepicker };
}
