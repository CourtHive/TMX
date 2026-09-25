import { currentSessionScope, sessionScopeUnchanged } from './sessionScope';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { context } from 'services/context';

const mockToken = vi.hoisted(() => ({ value: null as string | null }));

const USER_1 = 'user-1@courthive.test';
const USER_2 = 'user-2@courthive.test';
const ADMIN = 'admin-1@courthive.test';
const IMPERSONATED = 'BOBOCA';

vi.mock('services/authentication/tokenManagement', () => ({
  getToken: () => mockToken.value,
}));

/**
 * A real (unsigned) JWT, so the tests exercise the actual decode path rather
 * than a stubbed one. Nothing here verifies signatures — `jwtDecode` decodes.
 */
function tokenFor(claims: Record<string, unknown>): string {
  const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment(claims)}.signature-not-verified`;
}

describe('sessionScope', () => {
  beforeEach(() => {
    mockToken.value = null;
    context.provider = undefined;
  });

  it('is stable while nothing changes', () => {
    mockToken.value = tokenFor({ email: USER_1 });
    const captured = currentSessionScope();
    expect(sessionScopeUnchanged(captured)).toBe(true);
  });

  it('changes on logout — the 2026-09-15 case', () => {
    mockToken.value = tokenFor({ email: ADMIN });
    context.provider = { organisationAbbreviation: IMPERSONATED } as any;
    const captured = currentSessionScope();

    // stop impersonating, then log out
    context.provider = undefined;
    mockToken.value = null;

    expect(sessionScopeUnchanged(captured)).toBe(false);
  });

  it('changes when impersonation stops, even with the same user', () => {
    mockToken.value = tokenFor({ email: ADMIN });
    context.provider = { organisationAbbreviation: IMPERSONATED } as any;
    const captured = currentSessionScope();

    context.provider = undefined;

    expect(sessionScopeUnchanged(captured)).toBe(false);
  });

  it('changes when impersonation switches provider', () => {
    mockToken.value = tokenFor({ email: ADMIN });
    context.provider = { organisationAbbreviation: IMPERSONATED } as any;
    const captured = currentSessionScope();

    context.provider = { organisationAbbreviation: 'INTENNSE' } as any;

    expect(sessionScopeUnchanged(captured)).toBe(false);
  });

  it('changes when a different user signs in', () => {
    mockToken.value = tokenFor({ email: USER_1 });
    const captured = currentSessionScope();

    mockToken.value = tokenFor({ email: USER_2 });

    expect(sessionScopeUnchanged(captured)).toBe(false);
  });

  // The regression. Reading identity from `getUserContext()` made this case fail
  // OPEN: with the cache never filled the scope string was '|' before and after
  // the logout, so the guard reported "unchanged" and painted a logged-out
  // browser. Journey 124 fails on exactly this.
  it('changes on logout when /auth/me never filled the user context', () => {
    // `sub` only — no `email`, no `userId`: a token whose /auth/me has not landed,
    // which is also the shape e2e injects for an admin-gated journey.
    mockToken.value = tokenFor({ sub: 'e2e-superadmin', roles: ['superadmin'] });
    const captured = currentSessionScope();
    expect(captured).not.toBe('|');

    mockToken.value = null;

    expect(sessionScopeUnchanged(captured)).toBe(false);
  });

  // The other direction. A silent refresh rotates the access token mid-read; the
  // session did NOT move, so a legitimate response must not be discarded.
  it('does not move when a silent refresh rotates the token for the same user', () => {
    mockToken.value = tokenFor({ email: USER_1, exp: 1 });
    const captured = currentSessionScope();

    mockToken.value = tokenFor({ email: USER_1, exp: 2 });

    expect(mockToken.value).not.toBe(captured);
    expect(sessionScopeUnchanged(captured)).toBe(true);
  });

  it('treats an undecodable token as a session, so logging out still registers', () => {
    mockToken.value = 'not-a-jwt';
    const captured = currentSessionScope();
    expect(captured).not.toBe('|');

    mockToken.value = null;

    expect(sessionScopeUnchanged(captured)).toBe(false);
  });
});
