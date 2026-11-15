import { genderAccent } from './genderAccent';
import { describe, expect, it } from 'vitest';

describe('genderAccent', () => {
  it('colours each gender, whatever its case', () => {
    expect(genderAccent('MALE')).toBe('var(--tmx-accent-blue)');
    expect(genderAccent('female')).toBe('var(--tmx-accent-pink)');
    expect(genderAccent('Mixed')).toBe('var(--tmx-accent-purple)');
  });
  it('leaves an unknown or absent gender uncoloured', () => {
    expect(genderAccent('ANY')).toBe('');
    expect(genderAccent(undefined)).toBe('');
  });
});
