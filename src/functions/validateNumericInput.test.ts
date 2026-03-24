import { describe, expect, it } from 'vitest';
import { validateNumericInput } from './validateNumericInput';

describe('validateNumericInput', () => {
  describe('integer mode (decimals=false)', () => {
    it('strips leading non-digit character', () => {
      expect(validateNumericInput('a42', 100, false)).toBe('42');
    });

    it('passes valid integers', () => {
      expect(validateNumericInput('42', 100, false)).toBe('42');
    });

    it('returns empty string when exceeding maxValue', () => {
      expect(validateNumericInput('150', 100, false)).toBe('');
    });

    it('allows value equal to maxValue', () => {
      expect(validateNumericInput('100', 100, false)).toBe('100');
    });

    it('returns empty string for empty input', () => {
      expect(validateNumericInput('', 100, false)).toBe('');
    });

    it('skips maxValue check when maxValue is 0', () => {
      expect(validateNumericInput('999', 0, false)).toBe('999');
    });
  });

  describe('decimal mode (decimals=true)', () => {
    it('allows decimal point', () => {
      expect(validateNumericInput('12.5', 100, true)).toBe('12.5');
    });

    it('strips non-numeric non-dot characters', () => {
      expect(validateNumericInput('1a2.b5', 100, true)).toBe('12.5');
    });

    it('returns empty string when exceeding maxValue', () => {
      expect(validateNumericInput('101', 100, true)).toBe('');
    });

    it('passes valid decimal values', () => {
      expect(validateNumericInput('99.99', 100, true)).toBe('99.99');
    });
  });
});
