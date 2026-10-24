import { isHeldOffline, offlineHolder, visibleToSession } from './offlineCustody';
import { describe, expect, it } from 'vitest';

const A = 'a@example.com';
const B = 'b@example.com';

const record = (offline?: any) => ({
  tournamentId: 't1',
  parentOrganisation: { organisationId: 'p1' },
  timeItems: offline === undefined ? [] : [{ itemType: 'TMX', itemValue: { offline } }],
});

describe('offline custody', () => {
  it('reads the offline marker the way checkOfflineState does', () => {
    expect(isHeldOffline(record({ email: A }))).toBe(true);
    expect(isHeldOffline(record())).toBe(false);
    expect(isHeldOffline({ timeItems: [{ itemType: 'OTHER', itemValue: { offline: { email: 'x' } } }] })).toBe(false);
    expect(isHeldOffline(undefined)).toBe(false);
  });

  it('names the holder, lowercased', () => {
    expect(offlineHolder(record({ email: 'A@Example.com' }))).toBe(A);
    expect(offlineHolder(record(true))).toBeUndefined();
    expect(offlineHolder(record())).toBeUndefined();
  });

  it('shows a held record only to its holder', () => {
    const held = record({ email: A });
    expect(visibleToSession(held, A)).toBe(true);
    expect(visibleToSession(held, B)).toBe(false);
    expect(visibleToSession(held, undefined)).toBe(false);
  });

  it('leaves records that are not held offline visible, as before', () => {
    expect(visibleToSession(record(), B)).toBe(true);
    expect(visibleToSession(record(), undefined)).toBe(true);
  });

  it('keeps an unattributable marker visible rather than unreachable', () => {
    expect(visibleToSession(record(true), B)).toBe(true);
  });
});
