import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomId } from './randomId';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mints RFC 4122 version-4 UUIDs, distinct each call', () => {
    const ids = Array.from({ length: 200 }, randomId);
    expect(ids.every((id) => V4.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('works where crypto.randomUUID is withheld, as on a plain-http LAN page', () => {
    const { getRandomValues } = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: getRandomValues.bind(globalThis.crypto) });
    expect('randomUUID' in globalThis.crypto).toBe(false);
    expect(randomId()).toMatch(V4);
  });
});
