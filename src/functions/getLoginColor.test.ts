import { describe, expect, it } from 'vitest';
import { getLoginColor } from './getLoginColor';

describe('getLoginColor', () => {
  it('returns empty string when not valid', () => {
    expect(getLoginColor({ valid: false, impersonating: false, isSuperAdmin: false })).toBe('');
  });

  it('returns red when impersonating', () => {
    expect(getLoginColor({ valid: true, impersonating: true, isSuperAdmin: true })).toBe('var(--tmx-accent-red)');
  });

  it('returns green for super admin (not impersonating)', () => {
    expect(getLoginColor({ valid: true, impersonating: false, isSuperAdmin: true })).toBe('var(--tmx-accent-green)');
  });

  it('returns blue for regular logged-in user', () => {
    expect(getLoginColor({ valid: true, impersonating: false, isSuperAdmin: false })).toBe('var(--tmx-accent-blue)');
  });

  it('impersonating takes priority over super admin', () => {
    expect(getLoginColor({ valid: true, impersonating: true, isSuperAdmin: true })).toBe('var(--tmx-accent-red)');
  });
});
