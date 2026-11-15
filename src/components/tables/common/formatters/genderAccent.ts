import { genderConstants } from 'tods-competition-factory';

const { MALE, FEMALE, MIXED } = genderConstants;

/**
 * The gender accent TMX colours a person's name or an event by: blue, pink, and purple for mixed. Theme tokens
 * defined for light and dark (theme.css); `''` when the gender is unknown, so the caller's own colour stands.
 */
export function genderAccent(gender?: string): string {
  const value = gender?.toUpperCase();
  if (value === MALE) return 'var(--tmx-accent-blue)';
  if (value === FEMALE) return 'var(--tmx-accent-pink)';
  if (value === MIXED) return 'var(--tmx-accent-purple)';
  return '';
}
