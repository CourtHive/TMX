/**
 * Create a control bar button with configuration.
 * 
 * OVERVIEW:
 * Creates a styled button element for use in control bars with support for intents,
 * tooltips, positioning, visibility, and disabled states. Used by controlBar component
 * to render toolbar buttons.
 * 
 * PARAMETERS:
 * @param itemConfig - Button configuration object
 * @returns HTMLButtonElement ready to be added to control bar
 * 
 * ============================================================================
 * BUTTON PROPERTIES
 * ============================================================================
 * 
 * REQUIRED:
 * - label: String - button text/HTML to display
 * 
 * OPTIONAL STYLING:
 * - intent: String - button color intent (e.g., 'is-info', 'is-success', 'is-danger')
 * - class: String - additional CSS class to add to button
 * - location: String - 'right' positions button on right side with left margin
 *                      (default positions on left with right margin)
 * 
 * OPTIONAL BEHAVIOR:
 * - id: String - button element ID
 * - disabled: Boolean - if true, button is disabled on creation
 * - visible: Boolean - if false, button is hidden with display: none
 * - toolTip: Object - tippy.js tooltip configuration
 *   - content: String - tooltip text
 *   - placement: String - tooltip position ('top', 'bottom', 'left', 'right')
 *   - theme: String - tooltip theme
 *   - (all tippy.js options supported)
 * 
 * ============================================================================
 * STYLING DETAILS
 * ============================================================================
 * 
 * BASE STYLING:
 * - Always has 'button font-medium' classes
 * - Intent classes add color (is-info=blue, is-success=green, is-danger=red, etc.)
 * 
 * POSITIONING:
 * - Left side (default): margin-right: 1em
 * - Right side (location: 'right'): margin-left: 1em
 * 
 * VISIBILITY:
 * - visible: false sets display: none
 * - Can be toggled after creation via element.style.display
 * 
 * DISABLED STATE:
 * - disabled: true sets initial disabled state
 * - Can be toggled after creation via element.disabled = true/false
 * 
 * ============================================================================
 * TOOLTIP INTEGRATION
 * ============================================================================
 * 
 * TOOLTIP SETUP:
 * - Uses tippy.js for rich tooltips
 * - Automatically attached if toolTip.content provided
 * - Supports all tippy.js configuration options
 * 
 * COMMON TOOLTIP OPTIONS:
 * - content: String - tooltip text
 * - placement: 'top' | 'bottom' | 'left' | 'right'
 * - theme: 'light' | 'dark' | custom theme
 * - delay: [showDelay, hideDelay] in ms
 * - arrow: Boolean - show arrow pointing to button
 * 
 * ============================================================================
 * USAGE NOTES
 * ============================================================================
 * 
 * TYPICAL USAGE:
 * - Called by controlBar component to create toolbar buttons
 * - Returns HTMLButtonElement that needs onclick handler attached separately
 * - onClick handler attached by controlBar after button creation
 * 
 * EVENT HANDLING:
 * - Button element is returned without onclick handler
 * - Caller responsible for attaching event listeners
 * - Example: button.onclick = (e) => handleClick(e)
 * 
 * DYNAMIC CONTROL:
 * - Store reference to modify button after creation
 * - Change label: button.innerHTML = 'New Label'
 * - Toggle disabled: button.disabled = true/false
 * - Toggle visibility: button.style.display = 'none' or ''
 * 
 * ============================================================================
 * EXAMPLE USAGE
 * ============================================================================
 * 
 * @example
 * // Simple button
 * const button = barButton({
 *   label: 'Save',
 *   intent: 'is-success',
 *   id: 'saveButton'
 * });
 * button.onclick = () => saveData();
 * toolbar.appendChild(button);
 * 
 * @example
 * // Button with tooltip
 * const button = barButton({
 *   label: '<i class="fas fa-download"></i>',
 *   intent: 'is-info',
 *   toolTip: {
 *     content: 'Download tournament data',
 *     placement: 'bottom'
 *   }
 * });
 * button.onclick = () => downloadData();
 * toolbar.appendChild(button);
 * 
 * @example
 * // Right-aligned button
 * const button = barButton({
 *   label: 'Settings',
 *   location: 'right',
 *   intent: 'is-link'
 * });
 * button.onclick = () => openSettings();
 * toolbar.appendChild(button);
 * 
 * @example
 * // Initially disabled button
 * const button = barButton({
 *   label: 'Submit',
 *   disabled: true,
 *   intent: 'is-success'
 * });
 * button.onclick = () => submitForm();
 * // Enable later when form is valid:
 * formInput.addEventListener('input', () => {
 *   button.disabled = !isFormValid();
 * });
 * toolbar.appendChild(button);
 * 
 * @example
 * // Conditionally visible button
 * const button = barButton({
 *   label: 'Delete',
 *   intent: 'is-danger',
 *   visible: userCanDelete,
 *   toolTip: { content: 'Delete selected items' }
 * });
 * button.onclick = () => deleteItems();
 * toolbar.appendChild(button);
 * 
 * @example
 * // Button with custom class and HTML
 * const button = barButton({
 *   label: '<i class="fas fa-sync"></i> Refresh',
 *   class: 'is-small',
 *   intent: 'is-info',
 *   toolTip: {
 *     content: 'Refresh data from server',
 *     placement: 'top',
 *     delay: [500, 0]
 *   }
 * });
 * button.onclick = () => refreshData();
 * toolbar.appendChild(button);
 */
import tippy from 'tippy.js';

import { NONE, RIGHT } from 'constants/tmxConstants';

export function barButton(itemConfig: any): HTMLButtonElement {
  const elem = document.createElement('button');
  elem.className = 'button font-medium';
  if (itemConfig.disabled) elem.disabled = true;
  if (itemConfig.class) elem.classList.add(itemConfig.class);
  if (itemConfig.id) elem.id = itemConfig.id;

  if (itemConfig.location === RIGHT) {
    elem.style.marginLeft = '1em';
  } else {
    elem.style.marginRight = '1em';
  }

  if (itemConfig.intent) elem.classList.add(itemConfig.intent);
  if (itemConfig.toolTip?.content) tippy(elem, itemConfig.toolTip);
  elem.innerHTML = itemConfig.label;

  if (itemConfig.visible === false) {
    elem.style.display = NONE;
  }

  return elem;
}
