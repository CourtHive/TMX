/**
 * Workspace bulk-queue invariants.
 *
 * The scheduling workspace promotes the schedule2 grid's private
 * `pendingMethods` queue into a workspace-level service so that all three
 * modes (Availability, Profile, Grid) share one save model. The critic's
 * pre-mortem (Mentat/planning/SCHEDULE2_AVAILABILITY_INTEGRATION.md) flagged
 * the dual save-model race as the load-bearing risk; these tests pin the
 * resolved invariants.
 *
 * Verified properties:
 *   1. Immediate mode dispatches via mutationRequest synchronously.
 *   2. Bulk mode queues + applies locally; mutationRequest is NOT called.
 *   3. savePending flushes all queued batches via ONE mutationRequest.
 *   4. discardPending reloads from IDB AND clears the queue.
 *   5. setBulkMode(false) with pending changes triggers discardPending.
 *   6. Subscribers fire on every state transition.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted; mock spies must live in vi.hoisted so they
// initialize before the factories evaluate.
const {
  mutationRequestMock,
  executionQueueMock,
  setStateMock,
  getTournamentInfoMock,
  findTournamentMock,
  tmxToastMock,
} = vi.hoisted(() => ({
  mutationRequestMock: vi.fn(),
  executionQueueMock: vi.fn(),
  setStateMock: vi.fn(),
  getTournamentInfoMock: vi.fn(),
  findTournamentMock: vi.fn(),
  tmxToastMock: vi.fn(),
}));

vi.mock('services/mutation/mutationRequest', () => ({
  mutationRequest: mutationRequestMock,
}));

vi.mock('services/factory/engine', () => ({
  competitionEngine: {
    executionQueue: executionQueueMock,
    setState: setStateMock,
    getTournamentInfo: getTournamentInfoMock,
  },
}));

vi.mock('services/storage/tmx2db', () => ({
  tmx2db: { findTournament: findTournamentMock },
}));

vi.mock('services/notifications/tmxToast', () => ({
  tmxToast: tmxToastMock,
}));

vi.mock('tods-competition-factory', () => ({
  tools: { makeDeepCopy: (v: any) => JSON.parse(JSON.stringify(v)) },
}));

vi.mock('constants/tmxConstants', () => ({
  COMPETITION_ENGINE: 'competitionEngine',
}));

// Module under test — import after mocks so the mocks bind on first load.
import {
  executeMethods,
  setBulkMode,
  savePending,
  discardPending,
  hasUnsavedChanges,
  getPendingCount,
  subscribeQueue,
  resetQueue,
  isBulkMode,
  setAvailabilityDirty,
} from './queueService';

const TOURNAMENT_ID = 'T-test';
const SAMPLE_RECORD = { tournamentId: TOURNAMENT_ID, venues: [] };

beforeEach(() => {
  mutationRequestMock.mockReset();
  executionQueueMock.mockReset().mockReturnValue({});
  setStateMock.mockReset();
  getTournamentInfoMock.mockReset().mockReturnValue({ tournamentInfo: { tournamentId: TOURNAMENT_ID } });
  findTournamentMock.mockReset().mockResolvedValue(SAMPLE_RECORD);
  tmxToastMock.mockReset();
  resetQueue();
});

afterEach(() => {
  resetQueue();
});

describe('queueService — immediate mode', () => {
  it('dispatches via mutationRequest and does not queue', () => {
    expect(isBulkMode()).toBe(false);
    const methods = [{ method: 'addEvent', params: { eventId: 'E1' } }];
    executeMethods({ mode: 'grid', methods });

    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    expect(mutationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ methods, engine: 'competitionEngine' }),
    );
    expect(executionQueueMock).not.toHaveBeenCalled();
    expect(getPendingCount()).toBe(0);
    expect(hasUnsavedChanges()).toBe(false);
  });
});

describe('queueService — bulk mode', () => {
  beforeEach(() => {
    setBulkMode(true);
  });

  it('queues + applies locally without firing mutationRequest', () => {
    const methods = [{ method: 'addMatchUpScheduledTime', params: { matchUpId: 'M1' } }];
    executeMethods({ mode: 'availability', methods });

    expect(mutationRequestMock).not.toHaveBeenCalled();
    expect(executionQueueMock).toHaveBeenCalledTimes(1);
    expect(executionQueueMock).toHaveBeenCalledWith(methods, true);
    expect(getPendingCount()).toBe(1);
    expect(hasUnsavedChanges()).toBe(true);
  });

  it('queues batches from mixed modes', () => {
    executeMethods({ mode: 'grid', methods: [{ method: 'a', params: {} }] });
    executeMethods({ mode: 'availability', methods: [{ method: 'b', params: {} }] });
    executeMethods({ mode: 'profile', methods: [{ method: 'c', params: {} }] });

    expect(getPendingCount()).toBe(3);
    expect(mutationRequestMock).not.toHaveBeenCalled();
  });

  it('savePending flushes all queued batches via ONE mutationRequest', async () => {
    executeMethods({ mode: 'grid', methods: [{ method: 'a', params: { id: 1 } }] });
    executeMethods({ mode: 'availability', methods: [{ method: 'b', params: { id: 2 } }] });
    executeMethods({ mode: 'profile', methods: [{ method: 'c', params: { id: 3 } }] });

    await savePending();

    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    expect(mutationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        methods: [
          { method: 'a', params: { id: 1 } },
          { method: 'b', params: { id: 2 } },
          { method: 'c', params: { id: 3 } },
        ],
        engine: 'competitionEngine',
      }),
    );
    expect(getPendingCount()).toBe(0);
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('savePending is a no-op when nothing is queued', async () => {
    await savePending();
    expect(mutationRequestMock).not.toHaveBeenCalled();
  });

  it('discardPending reloads from IDB and clears the queue', async () => {
    executeMethods({ mode: 'grid', methods: [{ method: 'a', params: {} }] });
    executeMethods({ mode: 'availability', methods: [{ method: 'b', params: {} }] });
    expect(getPendingCount()).toBe(2);

    await discardPending();

    expect(findTournamentMock).toHaveBeenCalledWith(TOURNAMENT_ID);
    expect(setStateMock).toHaveBeenCalledWith(SAMPLE_RECORD);
    expect(getPendingCount()).toBe(0);
    expect(hasUnsavedChanges()).toBe(false);
    expect(tmxToastMock).toHaveBeenCalledWith(expect.objectContaining({ intent: 'is-warning' }));
  });

  it('discardPending does NOT touch state when there is nothing pending', async () => {
    await discardPending();
    expect(findTournamentMock).not.toHaveBeenCalled();
    expect(setStateMock).not.toHaveBeenCalled();
  });

  it('discardPending tolerates a missing IDB record without throwing', async () => {
    findTournamentMock.mockResolvedValueOnce(undefined);
    executeMethods({ mode: 'grid', methods: [{ method: 'a', params: {} }] });

    await expect(discardPending()).resolves.toBeUndefined();
    expect(setStateMock).not.toHaveBeenCalled();
    expect(getPendingCount()).toBe(0);
  });

  it('setBulkMode(false) with pending changes triggers discardPending', () => {
    executeMethods({ mode: 'grid', methods: [{ method: 'a', params: {} }] });
    expect(getPendingCount()).toBe(1);

    setBulkMode(false);

    expect(isBulkMode()).toBe(false);
    // discardPending runs asynchronously inside setBulkMode; assert it was
    // kicked off by checking the IDB read was scheduled.
    expect(findTournamentMock).toHaveBeenCalled();
  });
});

describe('queueService — subscriber lifecycle', () => {
  it('notifies subscribers on bulk-mode toggle, queue push, save, and discard', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeQueue(listener);

    setBulkMode(true);
    expect(listener).toHaveBeenCalledTimes(1);

    executeMethods({ mode: 'grid', methods: [{ method: 'a', params: {} }] });
    expect(listener).toHaveBeenCalledTimes(2);

    await savePending();
    expect(listener).toHaveBeenCalledTimes(3);

    executeMethods({ mode: 'availability', methods: [{ method: 'b', params: {} }] });
    expect(listener).toHaveBeenCalledTimes(4);

    await discardPending();
    expect(listener).toHaveBeenCalledTimes(5);

    unsubscribe();
    setBulkMode(false);
    expect(listener).toHaveBeenCalledTimes(5);
  });
});

describe('queueService — failure-mode invariants from the planning doc', () => {
  beforeEach(() => {
    setBulkMode(true);
  });

  it('local execution failure aborts the queue (does NOT push, no toast leak)', () => {
    executionQueueMock.mockReturnValueOnce({ error: 'simulated' });

    executeMethods({ mode: 'grid', methods: [{ method: 'a', params: {} }] });

    expect(getPendingCount()).toBe(0);
    expect(tmxToastMock).toHaveBeenCalledWith(expect.objectContaining({ intent: 'is-danger' }));
  });

  it('discardPending with no tournamentId clears the queue without IDB read', async () => {
    getTournamentInfoMock.mockReturnValueOnce({ tournamentInfo: undefined });
    executeMethods({ mode: 'grid', methods: [{ method: 'a', params: {} }] });

    await discardPending();

    expect(findTournamentMock).not.toHaveBeenCalled();
    expect(getPendingCount()).toBe(0);
  });
});

describe('queueService — painter dirty state alignment', () => {
  it('painter dirty makes hasUnsavedChanges true outside bulk mode', () => {
    expect(isBulkMode()).toBe(false);
    expect(hasUnsavedChanges()).toBe(false);

    setAvailabilityDirty(true, vi.fn());
    expect(hasUnsavedChanges()).toBe(true);
    expect(getPendingCount()).toBe(1);

    setAvailabilityDirty(false, null);
    expect(hasUnsavedChanges()).toBe(false);
    expect(getPendingCount()).toBe(0);
  });

  it('savePending invokes the registered painter save callback', async () => {
    const painterSave = vi.fn();
    setAvailabilityDirty(true, painterSave);

    await savePending();

    expect(painterSave).toHaveBeenCalledTimes(1);
  });

  it('savePending invokes painter save AND flushes bulk batches in one tick', async () => {
    const painterSave = vi.fn();
    setBulkMode(true);
    executeMethods({ mode: 'grid', methods: [{ method: 'a', params: {} }] });
    setAvailabilityDirty(true, painterSave);

    await savePending();

    expect(painterSave).toHaveBeenCalledTimes(1);
    expect(mutationRequestMock).toHaveBeenCalledTimes(1); // the bulk flush
  });

  it('painter dirty contributes 1 to getPendingCount alongside batches', () => {
    setBulkMode(true);
    executeMethods({ mode: 'grid', methods: [{ method: 'a', params: {} }] });
    executeMethods({ mode: 'grid', methods: [{ method: 'b', params: {} }] });
    expect(getPendingCount()).toBe(2);

    setAvailabilityDirty(true, vi.fn());
    expect(getPendingCount()).toBe(3);
  });

  it('subscribers are notified on dirty state transitions', () => {
    const listener = vi.fn();
    const unsub = subscribeQueue(listener);

    setAvailabilityDirty(true, vi.fn());
    expect(listener).toHaveBeenCalledTimes(1);

    setAvailabilityDirty(false, null);
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('resetQueue clears painter dirty state', () => {
    setAvailabilityDirty(true, vi.fn());
    expect(hasUnsavedChanges()).toBe(true);

    resetQueue();
    expect(hasUnsavedChanges()).toBe(false);
  });
});
