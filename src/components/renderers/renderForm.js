import { DateRangePicker } from 'vanillajs-datepicker';
import { isFunction } from 'functions/typeOf';
import { renderField } from './renderField';

export function renderForm(elem, items, relationships) {
  const div = document.createElement('div');
  div.style = 'display: flex; width: 100%;';
  div.classList.add('flexcol');

  const inputs = {},
    fields = {};

  let focus;

  for (const item of items) {
    if ((item.text || item.html) && !item.field) {
      const container = item.fieldPair && document.createElement('div');
      if (container) container.className = 'flexrow';

      const text = document.createElement('div');
      text.className = 'flexaligncenter';
      text.style =
        item.style || (item.header && 'font-weight: bold; font-size: larger;') || 'height: 2.5em; padding-right: 1em;';
      const content = document.createElement('div');
      if (item.id) content.id = item.id;
      content.className = 'content';
      content.innerHTML = item.text;
      text.appendChild(content);

      if (container) {
        container.appendChild(text);
        const { field: pair, inputElement, datepicker } = renderField(item.fieldPair);
        if (datepicker) inputs[`${item.field}.date`] = datepicker;
        if (inputElement) inputs[item.fieldPair.field] = inputElement;
        fields[item.fieldPair.field] = pair;
        container.appendChild(pair);
        div.appendChild(container);
      } else {
        div.appendChild(text);
      }

      continue;
    }
    if (item.divider) {
      const hr = document.createElement('hr');
      hr.classList.add('dropdown-divider');
      div.appendChild(hr);
      continue;
    }
    if (item.spacer) {
      const spacer = document.createElement('div');
      const spaceValue =
        (typeof item.spacer === 'number' && `${item.spacer}em`) ||
        (typeof item.spacer === 'string' && item.spacer) ||
        `1em`;
      spacer.style.marginBlockEnd = spaceValue;
      div.appendChild(spacer);
      continue;
    }
    if ((!item.label && !item.field) || item.hide) continue;

    if (item.field) {
      const container = item.fieldPair && document.createElement('div');
      if (container) container.className = 'flexrow';

      const { field, inputElement, datepicker, subFields } = renderField(item);
      if (subFields) subFields.forEach((subField) => (inputs[subField.field] = subField.input));
      if (datepicker) inputs[`${item.field}.date`] = datepicker;
      if (item.focus) focus = inputElement;
      inputs[item.field] = inputElement;
      fields[item.field] = field;

      if (container) {
        container.appendChild(field);
        const { field: pair, inputElement, datepicker } = renderField(item.fieldPair);
        if (datepicker) inputs[`${item.field}.date`] = datepicker;
        if (inputElement) inputs[item.fieldPair.field] = inputElement;
        fields[item.fieldPair.field] = pair;
        container.appendChild(pair);
        div.appendChild(container);
      } else {
        div.appendChild(field);
      }
    }
  }
  if (focus) setTimeout(() => focus.focus(), 200);

  elem.appendChild(div);

  if (relationships?.length) {
    for (const relationship of relationships) {
      if (relationship.dateRange && Array.isArray(relationship.fields)) {
        const [field1, field2] = relationship.fields;

        if (inputs[field1] && inputs[field2]) {
          const datepicker = new DateRangePicker(inputs[field1], {
            inputs: [inputs[field1], inputs[field2]],
            minDate: relationship.minDate,
            maxDate: relationship.maxDate,
            format: 'yyyy-mm-dd',
            autohide: true,
          });

          inputs[`${field1}.date`] = datepicker;
        }
      }

      if (relationship.control) {
        if (isFunction(relationship.onChange)) {
          inputs[relationship.control].addEventListener('change', (e) => relationship.onChange({ e, inputs, fields }));
        }
        if (isFunction(relationship.onInput) && inputs[relationship.control]) {
          inputs[relationship.control].addEventListener('input', (e) => relationship.onInput({ e, inputs, fields }));
        }
        if (isFunction(relationship.onFocusOut) && inputs[relationship.control]) {
          inputs[relationship.control].addEventListener('focusout', (e) =>
            relationship.onFocusOut({ e, inputs, fields }),
          );
        }
      }
    }
  }

  return inputs;
}
