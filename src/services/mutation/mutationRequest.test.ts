import { describe, expect, it, vi } from 'vitest';

// These pure helpers run outside clock control; demo-clock integration has its own browser journey.
vi.mock('services/clock/demoClock', () => ({ getDemoClock: () => undefined, canUseDemoClock: () => false }));
// A full stub: the real module needs factory tools, which the factory stub below does not carry. The demo date gate
// is tested as the pure recordsInDateRange below.
vi.mock('functions/venueTimeFrame', () => ({ venueCalendarDate: vi.fn(), venueTimeZone: vi.fn() }));
vi.mock('services/authentication/loginState', () => ({ getLoginState: vi.fn(), styleLogin: vi.fn() }));
vi.mock('services/storage/saveTournamentRecord', () => ({ saveTournamentRecord: vi.fn() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('services/messaging/socketIo', () => ({ emitTmx: vi.fn() }));
vi.mock('tods-competition-factory', () => ({
  tools: { unique: (a: any[]) => [...new Set(a)], makeDeepCopy: (a: any) => structuredClone(a) },
  // `services/factory/engine` wrapper imports both engines from the factory;
  // stub them so the wrapper resolves at module-load even though this test
  // never calls into them.
  tournamentEngine: {},
  competitionEngine: {},
}));
vi.mock('constants/tmxConstants', () => ({ SUPER_ADMIN: 'superadmin', TOURNAMENT_ENGINE: 'tournamentEngine' }));
// Mock the package directly so this test stays decoupled from the full
// mutation-name list. mutationRequest also reads `providerConfig.get()`
// for the permissions snapshot it passes into `isMutationAllowed`.
vi.mock('@courthive/provider-config', () => ({ isMutationAllowed: () => true }));
vi.mock('config/providerConfig', () => ({
  providerConfig: { isAllowed: () => true, get: () => ({ permissions: {} }) },
}));
vi.mock('config/serverConfig', () => ({ serverConfig: { get: () => ({}) } }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('services/context', () => ({ context: {} }));
vi.mock('functions/typeOf', () => ({ isFunction: (f: any) => typeof f === 'function' }));
vi.mock('i18n', () => ({ t: (k: string) => k }));
// Pipeline features read factory policy fixtures at load, which the factory stub above does not carry. Inactive here:
// their gate and injection are tested in pipelineFeatures.test.ts, and end to end through mutationRequest in journey 150.
vi.mock('services/pipeline/pipelineFeatures', () => ({
  isPipelineActive: () => false,
  callOverrideParams: () => ({}),
  pipelineForcesLocal: () => false,
  applyPipelineOverrides: (methods: any[]) => methods,
}));

import {
  checkOfflineState,
  applyDevOverrides,
  determineExecutionStrategy,
  recordsInDateRange,
} from './mutationRequest';

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

describe('recordsInDateRange', () => {
  const DEMO_ID = 'demo';
  const END_DATE = '2026-03-14';
  const INSIDE = '2026-03-13';
  const ENDED = { tournamentId: DEMO_ID, endDate: END_DATE };
  const AFTER_END = Date.parse('2026-10-19T12:00:00Z');
  const DURING = Date.parse('2026-03-12T12:00:00Z');

  it('without the demo clock it is the real-time check: an ended tournament is out of range', () => {
    expect(recordsInDateRange([ENDED], AFTER_END)).toBe(false);
    expect(recordsInDateRange([ENDED], DURING)).toBe(true);
  });

  it('the demo tournament is judged on the demo date, so a walkthrough inside its dates is in range', () => {
    expect(recordsInDateRange([ENDED], AFTER_END, { tournamentId: DEMO_ID, date: INSIDE })).toBe(true);
    expect(recordsInDateRange([ENDED], AFTER_END, { tournamentId: DEMO_ID, date: END_DATE })).toBe(true);
  });

  it('a demo date after the end date is out of range, even while real time is inside it', () => {
    expect(recordsInDateRange([ENDED], DURING, { tournamentId: DEMO_ID, date: '2026-03-15' })).toBe(false);
  });

  it('the demo date applies only to the tournament the clock runs on', () => {
    const other = { tournamentId: 'other', endDate: END_DATE };
    expect(recordsInDateRange([other], AFTER_END, { tournamentId: DEMO_ID, date: INSIDE })).toBe(false);
  });

  it('an empty demo date (no venue time zone) falls back to real time', () => {
    expect(recordsInDateRange([ENDED], AFTER_END, { tournamentId: DEMO_ID, date: '' })).toBe(false);
  });

  it('a record with no endDate is judged the same on either clock (real time treats it as in range)', () => {
    const open = { tournamentId: DEMO_ID };
    expect(recordsInDateRange([open], DURING)).toBe(true);
    expect(recordsInDateRange([open], DURING, { tournamentId: DEMO_ID, date: INSIDE })).toBe(true);
  });
});
