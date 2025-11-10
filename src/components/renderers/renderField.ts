/**
 * Render individual form field with various input types.
 * 
 * OVERVIEW:
 * Creates a single form field with flexible configuration for different input types,
 * validation, styling, and event handling. Used by renderForm to build complete forms.
 * 
 * PARAMETERS:
 * @param item - Field configuration object (see FIELD PROPERTIES below)
 * @returns Object with { field, inputElement, datepicker, subFields }
 *   - field: HTMLDivElement container with label and control
 *   - inputElement: The actual input element (input, select, or checkbox input)
 *   - datepicker: Datepicker instance if date field
 *   - subFields: Array of { field, input } for radio button options
 * 
 * ============================================================================
 * FIELD PROPERTIES - Common to All Types
 * ============================================================================
 * 
 * LAYOUT & STYLING:
 * - label: String - field label text (displayed above input)
 * - labelStyle: Custom CSS for label element
 * - class: CSS class to add to input element
 * - width: String - custom field width (e.g., '200px', '50%')
 * - visible: Boolean - if false, field is hidden with display: none
 * - controlVisible: Boolean - if false, hides the control element
 * - controlId: String - ID for the control container element
 * 
 * BASIC PROPERTIES:
 * - field: String - field name (used as key in inputs object)
 * - id: String - element ID for the input
 * - placeholder: String - placeholder text for inputs
 * - value: Initial value for the field
 * - disabled: Boolean - disables the input
 * - focus: Boolean - if true, receives focus after render
 * 
 * VALIDATION:
 * - validator: Function(value) => boolean - validation function
 * - error: String - error message shown when validation fails
 * 
 * EVENT HANDLERS:
 * - onChange: Function(event, item) - called when value changes
 * - onInput: Function(event, item) - called on every input
 * - onKeyDown: Function(event, item) - called on key press
 * - onKeyUp: Function(event, item) - called on key release
 * 
 * ============================================================================
 * INPUT TYPES
 * ============================================================================
 * 
 * 1. TEXT INPUT (default)
 * Properties:
 * - type: 'text' | 'password' | 'email' | 'number' | etc. (default: 'text')
 * - autocomplete: 'on' | 'off' (default: 'off')
 * - selectOnFocus: Boolean - selects all text when field receives focus
 * - iconLeft: String - Font Awesome icon class for left icon
 * - iconRight: String - Font Awesome icon class for right icon (password fields)
 * 
 * Example:
 * {
 *   label: 'Username',
 *   field: 'username',
 *   placeholder: 'Enter username',
 *   iconLeft: 'fas fa-user',
 *   validator: nameValidator(5),
 *   focus: true
 * }
 * 
 * 2. SELECT DROPDOWN
 * Properties:
 * - options: Array of option objects
 *   - label: Display text
 *   - value: Option value
 *   - selected: Boolean - pre-select this option
 *   - disabled: Boolean - disable this option
 *   - hide: Boolean - don't render this option
 * - multiple: Boolean - enable multi-select
 * - dataPlaceholder: String - placeholder attribute
 * - dataType: String - custom data-type attribute
 * - zIndex: Number - custom z-index for dropdown
 * - help: Object - help text configuration
 *   - text: String - help message
 *   - visible: Boolean - show/hide help text
 * 
 * Example:
 * {
 *   label: 'Country',
 *   field: 'country',
 *   options: [
 *     { label: 'USA', value: 'USA', selected: true },
 *     { label: 'GBR', value: 'GBR' }
 *   ]
 * }
 * 
 * 3. CHECKBOX
 * Properties:
 * - checkbox: Boolean - must be true
 * - label: String - checkbox label text
 * - checked: Boolean - initial checked state
 * - intent: String - color intent (default: 'is-success')
 * - color: String - custom label text color
 * 
 * IMPORTANT: Returns the actual <input type="checkbox"> element, not the wrapper div.
 * Access checked state with: inputs.fieldName.checked
 * 
 * Example:
 * {
 *   label: 'Remember me',
 *   field: 'remember',
 *   id: 'remember',
 *   checkbox: true,
 *   checked: false
 * }
 * 
 * 4. RADIO GROUP
 * Properties:
 * - radio: Boolean - must be true
 * - options: Array of radio option objects
 *   - text: Display text
 *   - checked: Boolean - pre-select this option
 *   - field: String - optional field name for this radio button
 *   - id: String - optional ID for this radio button
 * 
 * IMPORTANT: Returns the radio group container.
 * Access selected value with: inputs.fieldName.querySelector('input:checked').value
 * Individual radio buttons accessible via subFields if field property provided.
 * 
 * Example:
 * {
 *   radio: true,
 *   id: 'gender',
 *   options: [
 *     { text: 'Male', checked: true },
 *     { text: 'Female' }
 *   ]
 * }
 * 
 * 5. DATE PICKER
 * Properties:
 * - date: Boolean - must be true
 * - minDate: Date or string - minimum allowed date
 * - maxDate: Date or string - maximum allowed date
 * - maxNumberOfDates: Number - max dates selectable (default: 1)
 * - autohide: Boolean - auto-hide picker after selection
 * 
 * Returns datepicker instance accessible via: inputs['{fieldName}.date']
 * 
 * Example:
 * {
 *   label: 'Birth Date',
 *   field: 'birthDate',
 *   date: true,
 *   maxDate: new Date(),
 *   placeholder: 'YYYY-MM-DD'
 * }
 * 
 * 6. TYPE-AHEAD / AUTOCOMPLETE
 * Properties:
 * - typeAhead: Object - type-ahead configuration
 *   - list: Array of suggestions
 *   - callback: Function(value) - called when item selected
 *   - currentValue: String - initial value
 * 
 * Example:
 * {
 *   label: 'Country',
 *   field: 'country',
 *   typeAhead: {
 *     list: ['USA', 'GBR', 'FRA', 'ESP'],
 *     callback: (value) => console.log('Selected:', value),
 *     currentValue: 'USA'
 *   }
 * }
 * 
 * 7. STATIC TEXT/HTML
 * Properties:
 * - text: String - plain text to display (no input)
 * 
 * Example:
 * {
 *   text: 'Please enter your information below',
 *   id: 'instructions'
 * }
 * 
 * ============================================================================
 * USAGE NOTES
 * ============================================================================
 * 
 * FOCUS BEHAVIOR:
 * - Set focus: true on the item that should receive focus
 * - renderForm handles focus with 200ms delay for proper rendering
 * - Only one field should have focus: true
 * 
 * VALIDATION:
 * - Validators are functions that return boolean (true = valid)
 * - Error message displays in help text below input
 * - Validation runs on 'input' event (real-time)
 * 
 * CHECKBOX ACCESS:
 * - Always use: inputs.fieldName.checked
 * - Returns actual input element, not wrapper div
 * - Fixed in TypeScript conversion to maintain JS behavior
 * 
 * RADIO GROUP ACCESS:
 * - Selected value: inputs.fieldName.querySelector('input:checked').value
 * - Individual radios: inputs[subFieldName] if field property provided on options
 * 
 * FIELD PAIRING:
 * - Used in renderForm with fieldPair property
 * - Creates two fields in horizontal layout
 * - Both fields accessible via their field names in inputs object
 */
import { createTypeAhead } from 'services/dom/createTypeAhead';
import { Datepicker } from 'vanillajs-datepicker';
import { isFunction } from 'functions/typeOf';
import { validator } from './renderValidator';

import { NONE } from 'constants/tmxConstants';

export function renderOptions(select: HTMLSelectElement, item: any): void {
  for (const option of item.options) {
    if (option.hide) continue;
    const opt = document.createElement('option');
    opt.className = 'font-medium';
    if (option.value) opt.setAttribute('value', option.value);
    if (option.selected || item.value === option.value) opt.setAttribute('selected', 'true');
    if (option.disabled) opt.setAttribute('disabled', 'true');
    opt.innerHTML = option.label;
    select.appendChild(opt);
  }
}

export function renderField(item: any): { field: HTMLDivElement; inputElement?: HTMLDivElement | HTMLSelectElement; datepicker?: any; subFields?: any[] } {
  const field = document.createElement('div');
  field.className = 'field font-medium';
  if (item.class) field.classList.add(item.class);

  if (item.width) {
    field.style.cssText = `width: ${item.width}`;
  } else {
    field.style.cssText = 'flex-grow: 1';
  }

  if (item.label && !item.checkbox) {
    const label = document.createElement('label');
    label.style.cssText = item.labelStyle || 'font-weight: bold; font-size: larger;';
    label.innerHTML = item.label;
    field.appendChild(label);
  }

  let inputElement: HTMLDivElement | HTMLSelectElement | undefined,
    datepicker: any,
    subFields: any[] = [];

  const control = document.createElement('div');
  control.className = 'control font-medium';
  if (item.controlVisible === false) control.style.display = NONE;
  if (item.controlId) control.id = item.controlId;

  if (item.text) {
    const div = document.createElement('div');
    if (item.id) div.id = item.id;
    div.className = 'content';
    div.innerHTML = item.text;
    control.appendChild(div);
  } else if (item.radio) {
    const radioGroup = document.createElement('div');
    radioGroup.id = item.id;
    radioGroup.className = 'control';
    for (const option of item.options ?? []) {
      const label = document.createElement('label');
      label.className = 'radio';
      const input = document.createElement('input');
      if (option.field) subFields.push({ input, field: option.field });
      if (option.id) input.id = option.id;
      input.name = item.id;
      input.type = 'radio';
      input.value = option.text;
      if (option.checked) input.checked = true;
      label.appendChild(input);
      radioGroup.appendChild(label);
      const text = document.createElement('span');
      text.style.marginLeft = '.25em';
      text.style.marginRight = '1em';
      text.innerHTML = option.text;
      radioGroup.appendChild(text);
    }
    control.appendChild(radioGroup);
    inputElement = radioGroup;
  } else if (item.options) {
    const div = document.createElement('div');
    div.className = 'select font-medium';
    div.style.cssText = 'width: 100%';
    if (item.zIndex) div.style.zIndex = item.zIndex;
    const select = document.createElement('select');
    if (item.dataPlaceholder) select.setAttribute('data-placeholder', item.dataPlaceholder);
    if (item.dataType) select.setAttribute('data-type', item.dataType);
    if (item.multiple) select.setAttribute('multiple', 'true');
    if (item.disabled) select.disabled = true;
    if (item.id) div.id = item.id;
    select.style.cssText = 'width: 100%';
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
    div.className = 'flexrow nowrap';
    div.style.display = 'inline-block';
    const input = document.createElement('input');
    if (isFunction(item.onChange)) input.addEventListener('change', (e) => item.onChange(e, item));
    inputElement = input;  // Return the actual checkbox input, not the wrapper
    const intent = item.intent ?? 'is-success';
    input.className = `is-checkradio ${intent}`;
    input.type = 'checkbox';
    input.id = item.id;
    if (item.checked) input.checked = true;
    div.appendChild(input);
    const label = document.createElement('label');
    label.setAttribute('for', item.id);
    if (item.color) label.style.color = item.color;
    label.innerHTML = item.label;
    div.appendChild(label);
    control.appendChild(div);
  } else {
    const input = document.createElement('input');
    input.className = 'input font-medium';
    if (item.class) input.classList.add(item.class);
    input.setAttribute('type', item.type || 'text');
    input.setAttribute('autocomplete', item.autocomplete || 'off');
    input.setAttribute('placeholder', item.placeholder || '');
    if (item.disabled) input.setAttribute('disabled', 'true');
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
    inputElement = input as any;
    const help = document.createElement('p');
    help.className = 'help font-medium';
    control.appendChild(help);
    if (item.validator) {
      input.addEventListener('input', (e) => validator(item, e, input, help, item.validator));
    }
    if (item.date) {
      const maxNumberOfDates = item.maxNumberOfDates || 1;
      const autohide = !item.maxNumberOfDates || maxNumberOfDates === 1;
      datepicker = new Datepicker(input, {
        maxDate: item.maxDate,
        minDate: item.minDate,
        format: 'yyyy-mm-dd',
        maxNumberOfDates,
        autohide,
      });
    } else if (item.typeAhead) {
      createTypeAhead({ ...item.typeAhead, element: input });
    }
    if (isFunction(item.onKeyDown)) input.addEventListener('keydown', (e) => item.onKeyDown(e, item));
    if (isFunction(item.onChange)) input.addEventListener('change', (e) => item.onChange(e, item));
    if (isFunction(item.onInput)) input.addEventListener('input', (e) => item.onInput(e, item));
    if (isFunction(item.onKeyUp)) input.addEventListener('keyup', (e) => item.onKeyUp(e, item));
    if (item.value !== undefined) input.value = item.value;
    if (item.selectOnFocus) {
      input.addEventListener('focus', () => input.select());
    }
  }

  field.appendChild(control);
  if (item.visible === false) {
    field.style.display = NONE;
  }

  return { field, inputElement, datepicker, subFields };
}
