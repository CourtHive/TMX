import { currentSessionScope, sessionScopeUnchanged } from './sessionScope';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { context } from 'services/context';

const mockUserContext = vi.hoisted(() => ({ value: undefined as any }));

vi.mock('services/authentication/getUserContext', () => ({
  getUserContext: () => mockUserContext.value,
}));

describe('sessionScope', () => {
  beforeEach(() => {
    mockUserContext.value = undefined;
    context.provider = undefined;
  });

  it('is stable while nothing changes', () => {
    mockUserContext.value = { userId: 'user-1' };
    const captured = currentSessionScope();
    expect(sessionScopeUnchanged(captured)).toBe(true);
  });

  it('changes on logout — the 2026-09-15 case', () => {
    mockUserContext.value = { userId: 'admin-1' };
    context.provider = { organisationAbbreviation: 'BOBOCA' } as any;
    const captured = currentSessionScope();

    // stop impersonating, then log out
    context.provider = undefined;
    mockUserContext.value = undefined;

    expect(sessionScopeUnchanged(captured)).toBe(false);
  });

  it('changes when impersonation stops, even with the same user', () => {
    mockUserContext.value = { userId: 'admin-1' };
    context.provider = { organisationAbbreviation: 'BOBOCA' } as any;
    const captured = currentSessionScope();

    context.provider = undefined;

    expect(sessionScopeUnchanged(captured)).toBe(false);
  });

  it('changes when impersonation switches provider', () => {
    mockUserContext.value = { userId: 'admin-1' };
    context.provider = { organisationAbbreviation: 'BOBOCA' } as any;
    const captured = currentSessionScope();

    context.provider = { organisationAbbreviation: 'INTENNSE' } as any;

    expect(sessionScopeUnchanged(captured)).toBe(false);
  });

  it('changes when a different user signs in', () => {
    mockUserContext.value = { userId: 'user-1' };
    const captured = currentSessionScope();

    mockUserContext.value = { userId: 'user-2' };

    expect(sessionScopeUnchanged(captured)).toBe(false);
  });
});
