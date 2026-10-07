import { sessionChanged } from './watchSessionAcrossTabs';
import { describe, expect, it } from 'vitest';

// unsigned tokens: the watcher only decodes the claims, it never verifies
const token = (claims: Record<string, unknown>) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;

describe('sessionChanged — one acting provider per browser', () => {
  const clubSession = token({ userId: 'u1', providerId: 'club', iat: 1 });

  it('another tab switching provider changes the session', () => {
    expect(sessionChanged(clubSession, token({ userId: 'u1', providerId: 'league', iat: 2 }))).toBe(true);
  });

  it('another user signing in changes the session', () => {
    expect(sessionChanged(clubSession, token({ userId: 'u2', providerId: 'club', iat: 2 }))).toBe(true);
  });

  it('signing out changes the session', () => {
    expect(sessionChanged(clubSession, null)).toBe(true);
  });

  it('a silent refresh of the same session does NOT (no reload every 4h)', () => {
    expect(sessionChanged(clubSession, token({ userId: 'u1', providerId: 'club', iat: 99 }))).toBe(false);
  });
});
