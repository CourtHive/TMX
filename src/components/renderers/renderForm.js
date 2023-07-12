import { DateRangePicker } from 'vanillajs-datepicker';
import { isFunction } from 'functions/typeOf';
import { renderField } from './renderField';

export function renderForm(elem, items, relationships) {
  const div = document.createElement('div');
  div.style = 'display: flex; width: 100%;';
  div.classList.add('flexcol');

  const inputs = {},
    fields = {};

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
      const container = item.fieldPair && document.createElement('div');
      if (container) container.className = 'flexrow';

      const { field, inputElement, datepicker } = renderField(item);
      if (datepicker) inputs[`${item.field}.date`] = datepicker;
      inputs[item.field] = inputElement;
      fields[item.field] = field;

      if (container) {
        container.appendChild(field);
        const { field: pair, inputElement, datepicker } = renderField(item.fieldPair);
        if (datepicker) inputs[`${item.field}.date`] = datepicker;
        inputs[item.fieldPair.field] = inputElement;
        fields[item.fieldPair.field] = pair;
        container.appendChild(pair);
        div.appendChild(container);
      } else {
        div.appendChild(field);
      }
    }
  }

  elem.appendChild(div);

  if (relationships?.length) {
    for (const relationship of relationships) {
      if (relationship.dateRange && Array.isArray(relationship.fields)) {
        const [field1, field2] = relationship.fields;

        const datepicker = new DateRangePicker(inputs[field1], {
          inputs: [inputs[field1], inputs[field2]],
          format: 'yyyy-mm-dd',
          autohide: true
        });

        inputs[`${field1}.date`] = datepicker;
      }
      if (relationship.control && isFunction(relationship.onChange)) {
        inputs[relationship.control].addEventListener('change', (e) => relationship.onChange({ e, inputs, fields }));
      }
    }
  }

  return inputs;
}
