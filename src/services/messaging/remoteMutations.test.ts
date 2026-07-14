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
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { initRemoteMutationHandler } from './remoteMutations';

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
