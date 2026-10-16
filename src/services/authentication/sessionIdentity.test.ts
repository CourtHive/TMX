import { getSessionIdentity } from './sessionIdentity';
const token = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('./tokenManagement', () => ({ getToken: () => token.value }));
import { beforeEach, expect, it, vi } from 'vitest';
const jwt = (userId: string, exp: number) => `e30.${btoa(JSON.stringify({ userId, exp }))}.signature`;
beforeEach(() => {
  token.value = null;
});
it('keeps identity through expiry and changes it for another account', () => {
  token.value = jwt('user-a', 1);
  expect(getSessionIdentity()).toBe('user-a');
  token.value = jwt('user-a', 9999999999);
  expect(getSessionIdentity()).toBe('user-a');
  token.value = jwt('user-b', 9999999999);
  expect(getSessionIdentity()).toBe('user-b');
  token.value = null;
  expect(getSessionIdentity()).toBeUndefined();
});
it('does not derive identity from a malformed token', () => {
  token.value = 'invalid';
  expect(getSessionIdentity()).toBeUndefined();
});
