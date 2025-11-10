/**
 * Render modal buttons with configuration.
 * 
 * OVERVIEW:
 * Creates a row of buttons for modals and drawers with support for styling, intents,
 * disabled states, and click handlers. Used by baseModal and drawer components to
 * render footer buttons.
 * 
 * PARAMETERS:
 * @param target - Container element where buttons will be appended
 * @param buttons - Array of button configuration objects
 * @param close - Optional callback to close the modal/drawer after button click
 * @returns Object with { elements } - Map of button IDs to their HTMLElements
 * 
 * ============================================================================
 * BUTTON PROPERTIES
 * ============================================================================
 * 
 * REQUIRED:
 * - label: String - button text to display
 * 
 * OPTIONAL:
 * - id: String - button ID (also used as key in returned elements object)
 * - intent: String - button color intent (e.g., 'is-info', 'is-success', 'is-danger')
 * - disabled: Boolean - if true, button is disabled on render
 * - hide: Boolean - if true, button is not rendered
 * - onClick: Function() - callback when button is clicked
 * - close: Boolean - if false, prevents automatic modal close after click (default: true)
 * 
 * ============================================================================
 * BEHAVIOR
 * ============================================================================
 * 
 * CLICK FLOW:
 * 1. User clicks button
 * 2. Event propagation is stopped (e.stopPropagation)
 * 3. onClick callback is called (if provided and button not disabled)
 * 4. close callback is called to close modal/drawer (if provided)
 * 
 * DISABLED STATE:
 * - Buttons can be initially disabled via disabled: true
 * - Can be dynamically enabled/disabled via returned elements object:
 *   elements['buttonId'].disabled = true/false
 * - Disabled buttons don't trigger onClick callbacks
 * 
 * STYLING:
 * - All buttons have 'button font-medium' classes
 * - Intent classes add color (is-info=blue, is-success=green, is-danger=red, etc.)
 * - Right margin of 0.5em for spacing
 * 
 * ============================================================================
 * RETURN VALUE
 * ============================================================================
 * 
 * Returns object: { elements: Record<string, HTMLElement> }
 * - Keys: button IDs from button.id properties
 * - Values: HTMLButtonElement references for dynamic control
 * - Use for: enabling/disabling buttons, changing text, etc.
 * 
 * ACCESSING BUTTON ELEMENTS:
 * const { elements } = renderButtons(target, buttons, close);
 * elements['saveButton'].disabled = true;  // Disable button
 * elements['saveButton'].innerHTML = 'Saving...';  // Change label
 * 
 * ============================================================================
 * EXAMPLE USAGE
 * ============================================================================
 * 
 * @example
 * // Simple modal buttons
 * const { elements } = renderButtons(footerElement, [
 *   { label: 'Cancel', intent: 'none', close: true },
 *   { label: 'Save', id: 'saveBtn', intent: 'is-info', onClick: handleSave }
 * ], closeModal);
 * // Later: elements.saveBtn.disabled = false;
 * 
 * @example
 * // Form validation buttons
 * const buttons = [
 *   { label: 'Cancel', close: true },
 *   { 
 *     label: 'Submit', 
 *     id: 'submitBtn',
 *     disabled: true,  // Initially disabled
 *     intent: 'is-success',
 *     onClick: () => submitForm()
 *   }
 * ];
 * const { elements } = renderButtons(footer, buttons, closeDrawer);
 * // Enable when form is valid:
 * inputField.addEventListener('input', () => {
 *   elements.submitBtn.disabled = !isFormValid();
 * });
 * 
 * @example
 * // Conditional buttons
 * const buttons = [
 *   { label: 'Back', onClick: goBack },
 *   { label: 'Delete', intent: 'is-danger', hide: !canDelete, onClick: deleteItem },
 *   { label: 'Save', intent: 'is-info', onClick: saveItem }
 * ];
 * renderButtons(target, buttons);
 * 
 * @example
 * // Button without auto-close
 * const buttons = [
 *   { 
 *     label: 'Validate', 
 *     intent: 'is-warning',
 *     close: false,  // Don't close modal on click
 *     onClick: () => validateAndShowErrors()
 *   },
 *   { label: 'Submit', intent: 'is-success', onClick: submit }
 * ];
 * renderButtons(footer, buttons, closeModal);
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
