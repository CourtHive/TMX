import { DateRangePicker } from 'vanillajs-datepicker';
import { renderField } from './renderField';

export function renderForm(elem, items, relationships) {
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
      const { field, inputElement, datepicker } = renderField(item);
      if (datepicker) inputs[`${item.field}.date`] = datepicker;
      inputs[item.field] = inputElement;
      div.appendChild(field);
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
    }
  }

  return inputs;
}
