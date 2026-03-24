/**
 * Sanitize and validate a numeric input value.
 * Returns the cleaned string, or empty string if the value exceeds maxValue.
 */
export function validateNumericInput(value: string, maxValue: number, decimals: boolean): string {
  const regex = decimals ? /[^0-9.]/g : /^\D/g;
  const cleaned = value.replace(regex, '') || '';
  if (maxValue > 0 && Number(cleaned) > maxValue) return '';
  return cleaned;
}
