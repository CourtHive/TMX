import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the order of side effects so we can assert the cache is invalidated
// BEFORE the active view refreshes (otherwise refreshActiveTable re-reads a
// stale cache and the remote change never paints).
const order: string[] = [];

const executionQueueMock: any = vi.fn((..._a: any[]) => ({ success: true }));
const getStateMock: any = vi.fn((..._a: any[]) => ({ tournamentRecords: { t1: {} } }));
const saveTournamentRecordMock: any = vi.fn(async (..._a: any[]) => {});
const refreshActiveTableMock: any = vi.fn((..._a: any[]) => order.push('refresh'));
const eeEmitMock: any = vi.fn((..._a: any[]) => {});

let registeredListener: ((data: any) => void) | null = null;

vi.mock('tods-competition-factory', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    tournamentEngine: {
      getState: (...a: any[]) => getStateMock(...a),
      executionQueue: (...a: any[]) => executionQueueMock(...a),
    },
    tools: { ...actual.tools, makeDeepCopy: (x: any) => x },
  };
});

vi.mock('services/storage/saveTournamentRecord', () => ({
  saveTournamentRecord: (...a: any[]) => saveTournamentRecordMock(...a),
}));

vi.mock('services/messaging/socketIo', () => ({
  onTournamentMutation: (cb: any) => {
    registeredListener = cb;
  },
}));

vi.mock('services/transitions/activeScoringGuard', () => ({ notifyRemoteScoringCollision: vi.fn() }));

vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));

vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({ socketLog: false }) } }));

vi.mock('services/context', () => ({
  context: {
    refreshActiveTable: (...a: any[]) => refreshActiveTableMock(...a),
    ee: { emit: (...a: any[]) => eeEmitMock(...a) },
  },
}));

// Use the REAL observer registry — the contract under test is that
// handleRemoteMutation fires the same central notification local mutations do.
import { serverIsAhead, setServerSync } from 'services/staleness/serverSync';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { initRemoteMutationHandler } from './remoteMutations';
import { getOriginClientId } from './clientIdentity';

const REMOTE_METHODS = [{ method: 'setMatchUpStatus', params: {} }];
const remotePayload = (overrides: Record<string, any> = {}) => ({
  methods: REMOTE_METHODS,
  tournamentIds: ['t1'],
  userId: 'other-director',
  ...overrides,
});

describe('remoteMutations — cache invalidation + refresh ordering', () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    order.length = 0;
    executionQueueMock.mockClear().mockReturnValue({ success: true });
    getStateMock.mockClear().mockReturnValue({ tournamentRecords: { t1: {} } });
    saveTournamentRecordMock.mockClear();
    refreshActiveTableMock.mockClear();
    eeEmitMock.mockClear();
    registeredListener = null;
    unsubscribe = onMutationApplied(() => order.push('notify'));
    initRemoteMutationHandler();
  });

  afterEach(() => {
    unsubscribe();
  });

  it('invalidates caches before refreshing the active view', async () => {
    expect(registeredListener).toBeTypeOf('function');

    await registeredListener!(remotePayload());

    // notify (cache invalidation) must run, and must precede refresh.
    expect(order).toEqual(['notify', 'refresh']);
    expect(saveTournamentRecordMock).toHaveBeenCalledTimes(1);
    expect(eeEmitMock).toHaveBeenCalledWith('remoteMutation', {
      methods: REMOTE_METHODS,
      tournamentIds: ['t1'],
    });
  });

  it('does not notify when the affected tournament is not loaded locally', async () => {
    getStateMock.mockReturnValue({ tournamentRecords: {} });

    await registeredListener!(remotePayload());

    expect(order).toEqual([]);
    expect(executionQueueMock).not.toHaveBeenCalled();
  });

  it('does not notify or refresh when local execution errors', async () => {
    executionQueueMock.mockReturnValue({ error: { message: 'boom' } });

    await registeredListener!(remotePayload());

    expect(order).toEqual([]);
    expect(refreshActiveTableMock).not.toHaveBeenCalled();
  });

  it('defers the in-place refresh while a scoring modal is open', async () => {
    // A destroy+rebuild refresher (round-robin bracket) would invalidate the open
    // modal's save callback, and mutationRequest does not re-render on its own — so
    // while a scoring modal (.cModal) is open, handleRemoteMutation must apply the
    // change to the engine but NOT re-render (it surfaces the sync indicator instead).
    const originalDocument = (globalThis as any).document;
    (globalThis as any).document = {
      querySelector: (sel: string) => (sel === '.cModal' ? {} : null),
      getElementById: () => null,
    };
    try {
      await registeredListener!(remotePayload());

      // Change is still applied + persisted (no data lost)...
      expect(order).toContain('notify');
      expect(saveTournamentRecordMock).toHaveBeenCalledTimes(1);
      // ...but the active-view refresh is deferred so the open scorer isn't clobbered.
      expect(refreshActiveTableMock).not.toHaveBeenCalled();
    } finally {
      (globalThis as any).document = originalDocument;
    }
  });
});

describe('remoteMutations — own-mutation echo', () => {
  beforeEach(() => {
    executionQueueMock.mockClear().mockReturnValue({ success: true });
    getStateMock.mockClear().mockReturnValue({ tournamentRecords: { t1: {} } });
    saveTournamentRecordMock.mockClear();
    registeredListener = null;
    initRemoteMutationHandler();
  });

  // A transport that cannot exclude the sender delivers our own mutation back to us; it has
  // already been applied locally, so applying it again would double it.
  it("skips a broadcast carrying this tab's originClientId", async () => {
    await registeredListener!(remotePayload({ originClientId: getOriginClientId() }));

    expect(executionQueueMock).not.toHaveBeenCalled();
    expect(saveTournamentRecordMock).not.toHaveBeenCalled();
  });

  it("applies a broadcast carrying another tab's originClientId", async () => {
    await registeredListener!(remotePayload({ originClientId: 'some-other-tab' }));

    expect(executionQueueMock).toHaveBeenCalledTimes(1);
  });
});

// P49: an applied broadcast moves this tab's sync point; a failed one leaves it where it was, so the
// staleness probe can see the write this tab does not hold.
describe('remoteMutations — sync point', () => {
  const at = (minute: number) => `2026-10-08T19:${String(minute).padStart(2, '0')}:00.000Z`;
  const step = { previousServerUpdatedAt: { t1: at(10) }, serverUpdatedAt: { t1: at(11) } };

  beforeEach(() => {
    executionQueueMock.mockReset().mockReturnValue({ success: true });
    getStateMock.mockReset().mockReturnValue({ tournamentRecords: { t1: {} } });
    registeredListener = null;
    initRemoteMutationHandler();
    setServerSync('t1', at(10));
  });

  it('advances when the broadcast is applied', async () => {
    await registeredListener!(remotePayload(step));
    expect(serverIsAhead('t1', at(11))).toBe(false);
  });

  it('does not advance when applying it failed', async () => {
    executionQueueMock.mockReturnValue({ error: { message: 'boom' } });
    await registeredListener!(remotePayload(step));
    expect(serverIsAhead('t1', at(11))).toBe(true);
  });
});
