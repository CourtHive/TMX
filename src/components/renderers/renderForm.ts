/**
 * Render form with multiple fields and relationships.
 * 
 * OVERVIEW:
 * Creates a flexible form system with support for various input types, validation,
 * field pairing, date ranges, and dynamic event handlers. Returns an inputs object
 * for programmatic access to all form fields.
 * 
 * PARAMETERS:
 * @param elem - Container element where the form will be rendered
 * @param items - Array of field configuration objects (see ITEM PROPERTIES below)
 * @param relationships - Optional array of field relationships for validation and events
 * @returns Object containing all input elements keyed by field name
 * 
 * ============================================================================
 * ITEM PROPERTIES
 * ============================================================================
 * 
 * DISPLAY ITEMS (non-field items):
 * - text: Display text content (no input field)
 * - html: Display HTML content (no input field)
 * - header: Boolean - if true, styles text as bold/large header
 * - style: Custom CSS string for text elements
 * - id: Element ID for text container
 * - divider: Boolean - renders horizontal divider
 * - spacer: Number (in ems) or string - adds vertical spacing
 * - hide: Boolean - skips rendering this item
 * 
 * INPUT FIELD ITEMS:
 * - field: String - field name (required, used as key in returned inputs object)
 * - label: String - field label text
 * - labelStyle: Custom CSS for label
 * - placeholder: String - input placeholder text
 * - value: Initial value for the field
 * - focus: Boolean - if true, this field receives focus after render (200ms delay)
 * - disabled: Boolean - disables the input
 * - class: CSS class to add to input element
 * - width: String - custom width (e.g., '200px', '50%')
 * - visible: Boolean - if false, hides the field with display: none
 * 
 * FIELD PAIRING:
 * - fieldPair: Object - configuration for a paired field (displayed in same row)
 *   Creates horizontal layout with two fields side-by-side
 *   fieldPair has same properties as regular items
 * 
 * INPUT TYPES (see renderField.ts for detailed field type documentation):
 * - Basic text input (default)
 * - Select dropdown (options property)
 * - Checkbox (checkbox: true)
 * - Radio group (radio: true)
 * - Date picker (date: true)
 * - Type-ahead/autocomplete (typeAhead: object)
 * 
 * ============================================================================
 * RELATIONSHIPS
 * ============================================================================
 * 
 * Relationships define inter-field dependencies, validation, and event handlers.
 * Each relationship object can have:
 * 
 * DATE RANGE RELATIONSHIPS:
 * - dateRange: Boolean - enables date range picker between two fields
 * - fields: [field1, field2] - array of two field names to link
 * - minDate: Date or string - minimum allowed date
 * - maxDate: Date or string - maximum allowed date
 * 
 * EVENT HANDLER RELATIONSHIPS:
 * - control: String - field name to attach event listeners to
 * - onChange: Function({ e, inputs, fields }) - called when field value changes
 * - onInput: Function({ e, inputs, fields }) - called on every input (typing)
 * - onFocusOut: Function({ e, inputs, fields }) - called when field loses focus
 * 
 * EVENT HANDLER PARAMETERS:
 * - e: Event - the DOM event object
 * - inputs: Object - all input elements by field name
 * - fields: Object - all field container elements by field name
 * 
 * ============================================================================
 * RETURN VALUE
 * ============================================================================
 * 
 * Returns an object containing all input elements:
 * - Keys: field names from item.field properties
 * - Values: HTML input elements (input, select, div for checkboxes/radios)
 * - Special keys: {fieldName}.date for datepicker instances
 * 
 * ACCESSING VALUES:
 * - Text inputs: inputs.fieldName.value
 * - Selects: inputs.fieldName.value
 * - Checkboxes: inputs.fieldName.checked (returns actual input element)
 * - Radio groups: inputs.fieldName.querySelector('input:checked').value
 * - Datepickers: inputs['fieldName.date'] (Datepicker instance)
 * 
 * ============================================================================
 * EXAMPLE USAGE
 * ============================================================================
 * 
 * @example
 * // Simple form with validation
 * const inputs = renderForm(container, [
 *   {
 *     label: 'Full Name',
 *     field: 'fullName',
 *     placeholder: 'Enter name',
 *     validator: nameValidator(5),
 *     error: 'Minimum 5 characters',
 *     focus: true
 *   },
 *   {
 *     label: 'Email',
 *     field: 'email',
 *     type: 'email',
 *     validator: emailValidator(),
 *   }
 * ]);
 * // Access values: inputs.fullName.value, inputs.email.value
 * 
 * @example
 * // Form with field pairing (two fields in one row)
 * const inputs = renderForm(container, [
 *   {
 *     text: 'Start Time:',
 *     fieldPair: {
 *       field: 'startTime',
 *       placeholder: '9:00',
 *       focus: true
 *     }
 *   }
 * ]);
 * 
 * @example
 * // Form with date range
 * const inputs = renderForm(container, [
 *   { label: 'Start Date', field: 'startDate', date: true },
 *   { label: 'End Date', field: 'endDate', date: true }
 * ], [
 *   {
 *     dateRange: true,
 *     fields: ['startDate', 'endDate'],
 *     minDate: '2024-01-01',
 *     maxDate: '2024-12-31'
 *   }
 * ]);
 * 
 * @example
 * // Form with dynamic validation
 * const inputs = renderForm(container, [
 *   { label: 'Password', field: 'password', type: 'password' },
 *   { label: 'Confirm', field: 'confirm', type: 'password' }
 * ], [
 *   {
 *     control: 'confirm',
 *     onInput: ({ e, inputs, fields }) => {
 *       const match = inputs.password.value === inputs.confirm.value;
 *       // Update UI based on validation
 *     }
 *   }
 * ]);
 * 
 * @example
 * // Form with mixed item types
 * const inputs = renderForm(container, [
 *   { text: '<h3>User Registration</h3>', header: true },
 *   { divider: true },
 *   { label: 'Username', field: 'username', focus: true },
 *   { spacer: 2 },
 *   { label: 'Country', field: 'country', options: countryOptions },
 *   { label: 'Save credentials', field: 'remember', checkbox: true }
 * ]);
 */
import { DateRangePicker } from 'vanillajs-datepicker';
import { isFunction } from 'functions/typeOf';
import { renderField } from './renderField';

export function renderForm(elem: HTMLElement, items: any[], relationships?: any[]): any {
  const div = document.createElement('div');
  div.style.cssText = 'display: flex; width: 100%;';
  div.classList.add('flexcol');

  const inputs: any = {},
    fields: any = {};

  let focus: HTMLElement | undefined;

  for (const item of items) {
    if ((item.text || item.html) && !item.field) {
      const container = item.fieldPair && document.createElement('div');
      if (container) container.className = 'flexrow';

      const text = document.createElement('div');
      text.className = 'flexaligncenter';
      text.style.cssText =
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
        if (inputElement) {
          inputs[item.fieldPair.field] = inputElement;
          if (item.fieldPair.focus) focus = inputElement as HTMLElement;
        }
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
      if (subFields) subFields.forEach((subField: any) => (inputs[subField.field] = subField.input));
      if (datepicker) inputs[`${item.field}.date`] = datepicker;
      if (item.focus) focus = inputElement as HTMLElement;
      inputs[item.field] = inputElement;
      fields[item.field] = field;

      if (container) {
        container.appendChild(field);
        const { field: pair, inputElement, datepicker } = renderField(item.fieldPair);
        if (datepicker) inputs[`${item.field}.date`] = datepicker;
        if (inputElement) {
          inputs[item.fieldPair.field] = inputElement;
          if (item.fieldPair.focus) focus = inputElement as HTMLElement;
        }
        fields[item.fieldPair.field] = pair;
        container.appendChild(pair);
        div.appendChild(container);
      } else {
        div.appendChild(field);
      }
    }
  }
  if (focus) setTimeout(() => focus!.focus(), 200);

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
          inputs[relationship.control].addEventListener('change', (e: Event) =>
            relationship.onChange({ e, inputs, fields }),
          );
        }
        if (isFunction(relationship.onInput) && inputs[relationship.control]) {
          inputs[relationship.control].addEventListener('input', (e: Event) =>
            relationship.onInput({ e, inputs, fields }),
          );
        }
        if (isFunction(relationship.onFocusOut) && inputs[relationship.control]) {
          inputs[relationship.control].addEventListener('focusout', (e: Event) =>
            relationship.onFocusOut({ e, inputs, fields }),
          );
        }
      }
    }
  }

  return inputs;
}
