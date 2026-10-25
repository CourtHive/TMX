import { getLoginColor } from './getLoginColor';
import { describe, expect, it } from 'vitest';

describe('getLoginColor', () => {
  it('returns empty string when not valid', () => {
    expect(getLoginColor({ valid: false, impersonating: false, isSuperAdmin: false })).toBe('');
  });

  it('returns the chrome danger color when impersonating', () => {
    expect(getLoginColor({ valid: true, impersonating: true, isSuperAdmin: true })).toBe('var(--tmx-chrome-danger)');
  });

  it('returns the chrome success color for super admin (not impersonating)', () => {
    expect(getLoginColor({ valid: true, impersonating: false, isSuperAdmin: true })).toBe('var(--tmx-chrome-success)');
  });

  it('returns the chrome active color for a regular logged-in user', () => {
    expect(getLoginColor({ valid: true, impersonating: false, isSuperAdmin: false })).toBe('var(--tmx-chrome-active)');
  });

  it('impersonating takes priority over super admin', () => {
    expect(getLoginColor({ valid: true, impersonating: true, isSuperAdmin: true })).toBe('var(--tmx-chrome-danger)');
  });
});
