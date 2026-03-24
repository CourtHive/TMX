import { describe, expect, it } from 'vitest';
import { isEmbargoActive } from './isEmbargoActive';

describe('isEmbargoActive', () => {
  it('returns true for a future date', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isEmbargoActive(future)).toBe(true);
  });

  it('returns false for a past date', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isEmbargoActive(past)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isEmbargoActive(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEmbargoActive('')).toBe(false);
  });
});
