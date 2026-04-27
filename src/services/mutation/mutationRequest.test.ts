import { describe, expect, it, vi } from 'vitest';

vi.mock('services/authentication/loginState', () => ({ getLoginState: vi.fn(), styleLogin: vi.fn() }));
vi.mock('services/storage/saveTournamentRecord', () => ({ saveTournamentRecord: vi.fn() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('services/messaging/socketIo', () => ({ emitTmx: vi.fn() }));
vi.mock('tods-competition-factory', () => ({
  tools: { unique: (a: any[]) => [...new Set(a)], makeDeepCopy: (a: any) => JSON.parse(JSON.stringify(a)) },
}));
vi.mock('constants/tmxConstants', () => ({ SUPER_ADMIN: 'superadmin', TOURNAMENT_ENGINE: 'tournamentEngine' }));
// `constants/mutationConstants` is now consumed transitively via
// `constants/mutationPermissions`. Mock the permissions module directly
// so this test stays decoupled from the full mutation-name list.
vi.mock('constants/mutationPermissions', () => ({ isMutationAllowed: () => true }));
vi.mock('config/providerConfig', () => ({ providerConfig: { isAllowed: () => true } }));
vi.mock('config/serverConfig', () => ({ serverConfig: { get: () => ({}) } }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('services/context', () => ({ context: {} }));
vi.mock('functions/typeOf', () => ({ isFunction: (f: any) => typeof f === 'function' }));
vi.mock('i18n', () => ({ t: (k: string) => k }));

import { checkOfflineState, applyDevOverrides, determineExecutionStrategy } from './mutationRequest';

describe('checkOfflineState', () => {
  it('returns offline=0 when no tournament records have offline timeItems', () => {
    let result: any = checkOfflineState({
      t1: { timeItems: [] },
      t2: {},
    });
    expect(result.offline).toBe(0);
    expect(result.invalidOffline).toBe(false);
  });

  it('returns offline count for records with TMX offline timeItems', () => {
    let result: any = checkOfflineState({
      t1: { timeItems: [{ itemType: 'TMX', itemValue: { offline: { email: 'a@b.com' } } }] },
      t2: { timeItems: [{ itemType: 'TMX', itemValue: { offline: { email: 'a@b.com' } } }] },
    });
    expect(result.offline).toBe(2);
    expect(result.invalidOffline).toBe(false);
  });

  it('flags invalidOffline when multiple records have different offline emails', () => {
    let result: any = checkOfflineState({
      t1: { timeItems: [{ itemType: 'TMX', itemValue: { offline: { email: 'a@b.com' } } }] },
      t2: { timeItems: [{ itemType: 'TMX', itemValue: { offline: { email: 'x@y.com' } } }] },
    });
    expect(result.invalidOffline).toBe(true);
  });

  it('does not flag invalidOffline with a single offline record', () => {
    let result: any = checkOfflineState({
      t1: { timeItems: [{ itemType: 'TMX', itemValue: { offline: { email: 'a@b.com' } } }] },
    });
    expect(result.offline).toBe(1);
    expect(result.invalidOffline).toBe(false);
  });

  it('handles empty records', () => {
    let result: any = checkOfflineState({});
    expect(result.offline).toBe(0);
    expect(result.invalidOffline).toBe(false);
  });
});

describe('applyDevOverrides', () => {
  it('returns methods unchanged when no devParams', () => {
    const methods = [{ method: 'addEvent', params: { eventName: 'test' } }];
    let result: any = applyDevOverrides(methods);
    expect(result).toBe(methods);
  });

  it('returns methods unchanged when devParams is undefined', () => {
    const methods = [{ method: 'addEvent', params: { eventName: 'test' } }];
    let result: any = applyDevOverrides(methods, undefined);
    expect(result).toBe(methods);
  });

  it('merges matching devParams into method params', () => {
    const methods = [{ method: 'addEvent', params: { eventName: 'test' } }];
    const devParams = { addEvent: { debug: true } };
    let result: any = applyDevOverrides(methods, devParams);
    expect(result[0].params).toEqual({ eventName: 'test', debug: true });
  });

  it('does not modify methods that have no matching devParams', () => {
    const methods = [{ method: 'addEvent', params: { eventName: 'test' } }];
    const devParams = { deleteEvent: { force: true } };
    let result: any = applyDevOverrides(methods, devParams);
    expect(result[0].params).toEqual({ eventName: 'test' });
  });

  it('does not mutate the original methods array', () => {
    const original = { method: 'addEvent', params: { eventName: 'test' } };
    const methods = [original];
    applyDevOverrides(methods, { addEvent: { debug: true } });
    expect(original.params).toEqual({ eventName: 'test' });
  });
});

describe('determineExecutionStrategy', () => {
  it('returns local-only when no provider', () => {
    let result: any = determineExecutionStrategy(false, false, true);
    expect(result).toBe('local-only');
  });

  it('returns local-only when offline', () => {
    let result: any = determineExecutionStrategy(true, true, true);
    expect(result).toBe('local-only');
  });

  it('returns local-first when provider exists but serverFirst is off', () => {
    let result: any = determineExecutionStrategy(true, false, false);
    expect(result).toBe('local-first');
  });

  it('returns server-first when provider exists and serverFirst is on', () => {
    let result: any = determineExecutionStrategy(true, false, true);
    expect(result).toBe('server-first');
  });
});
