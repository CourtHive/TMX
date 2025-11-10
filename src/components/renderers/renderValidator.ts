/**
 * Validate input field and update UI with success/error styling.
 * 
 * OVERVIEW:
 * Runs a validation function on input value and updates the input field and help text
 * with appropriate styling (success=green, error=red) and error messages. Used by
 * renderField to provide real-time validation feedback.
 * 
 * PARAMETERS:
 * @param item - Field configuration object containing error message
 * @param e - Event object with target.value containing input value
 * @param input - Input element to add success/error classes to
 * @param help - Help text element to display error message
 * @param fx - Validation function that returns true if valid, false if invalid
 * 
 * ============================================================================
 * BEHAVIOR
 * ============================================================================
 * 
 * VALIDATION FLOW:
 * 1. Extract value from e.target.value
 * 2. Call validation function fx(value)
 * 3. If invalid (fx returns false):
 *    - Set help text to item.error or 'Invalid'
 *    - Remove 'is-success' class from input
 *    - Add 'is-danger' class to input (red border)
 *    - Add 'is-danger' class to help (red text)
 * 4. If valid (fx returns true):
 *    - Clear help text
 *    - Remove 'is-danger' classes
 *    - Add 'is-success' class to input (green border)
 * 
 * VISUAL FEEDBACK:
 * - Invalid: Red border on input + red error message below
 * - Valid: Green border on input + no message
 * - Neutral: No border color + no message (before first input)
 * 
 * ============================================================================
 * VALIDATION FUNCTIONS
 * ============================================================================
 * 
 * Validation functions should:
 * - Accept a string value parameter
 * - Return true if valid, false if invalid
 * - Be synchronous (no async validation)
 * 
 * COMMON VALIDATORS:
 * - nameValidator(minLength) - checks minimum character length
 * - emailValidator() - validates email format
 * - passwordValidator() - checks password requirements
 * - numericRange(min, max) - validates number is in range
 * - Custom: (value) => value.length > 0 && value.includes('@')
 * 
 * ============================================================================
 * USAGE NOTES
 * ============================================================================
 * 
 * TYPICAL USAGE:
 * - Called automatically by renderField when validator property is set
 * - Attached to 'input' event for real-time validation
 * - Rarely called directly - use via renderField configuration
 * 
 * ERROR MESSAGES:
 * - Set via item.error property in field configuration
 * - Default message is 'Invalid' if item.error not provided
 * - Should be clear and actionable (e.g., "Minimum 5 characters")
 * 
 * STYLING:
 * - Uses Bulma CSS classes: is-success, is-danger
 * - Input field gets colored border
 * - Help text appears below input with matching color
 * 
 * ============================================================================
 * EXAMPLE USAGE
 * ============================================================================
 * 
 * @example
 * // Automatic usage via renderField
 * const field = renderField({
 *   label: 'Username',
 *   field: 'username',
 *   validator: (value) => value.length >= 5,
 *   error: 'Username must be at least 5 characters'
 * });
 * // validator() is called automatically on input event
 * 
 * @example
 * // Direct usage (rare)
 * const input = document.getElementById('email');
 * const help = document.getElementById('email-help');
 * const item = { error: 'Invalid email format' };
 * const emailValidator = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
 * 
 * input.addEventListener('input', (e) => {
 *   validator(item, e, input, help, emailValidator);
 * });
 * 
 * @example
 * // Custom validator with multiple conditions
 * const passwordValidator = (value) => {
 *   return value.length >= 8 && 
 *          /[A-Z]/.test(value) && 
 *          /[0-9]/.test(value);
 * };
 * const field = renderField({
 *   label: 'Password',
 *   field: 'password',
 *   type: 'password',
 *   validator: passwordValidator,
 *   error: 'Password must be 8+ chars with uppercase and number'
 * });
 */
export function validator(item: any, e: any, input: HTMLElement, help: HTMLElement, fx?: (value: string) => boolean): void {
  if (fx) {
    const value = e.target.value;
    if (!fx(value)) {
      help.innerHTML = item.error || 'Invalid';
      input.classList.remove('is-success');
      input.classList.add('is-danger');
      help.classList.add('is-danger');
    } else {
      help.innerHTML = '';
      help.classList.remove('is-danger');
      input.classList.remove('is-danger');
      input.classList.add('is-success');
    }
  }
}
