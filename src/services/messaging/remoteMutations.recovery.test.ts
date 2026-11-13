import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Option B (planning/TMX_CHECK_IN_INTENTS_AND_RECONNECT.md): a surface that opted in has a stale record pulled and
 * installed without a click, and only while nothing would be lost or overtaken. Everywhere else the stale indicator
 * keeps meaning "click to refresh".
 */

const h = vi.hoisted(() => ({
  tournamentId: 't1' as string | undefined,
  setState: vi.fn((..._a: any[]) => ({ success: true })),
  requestTournament: vi.fn(),
  unsettled: 0,
  scoring: false,
  current: true,
  indicator: undefined as any,
}));

vi.mock('tods-competition-factory', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    tournamentEngine: {
      getTournamentId: () => h.tournamentId,
      setState: (...a: any[]) => h.setState(...a),
      getState: () => ({ tournamentRecords: { t1: {} } }),
      executionQueue: () => ({ success: true }),
    },
  };
});
vi.mock('services/apis/servicesApi', () => ({ requestTournament: (...a: any[]) => h.requestTournament(...a) }));
vi.mock('services/tournament/operationOwnership', () => ({
  captureTournamentOperation: () => () => h.current,
  markTournamentRecordInstalled: vi.fn(),
}));
vi.mock('services/messaging/socketIo', () => ({
  onDurableRecovery: vi.fn(),
  onTournamentMutation: vi.fn(),
  onTournamentReplaced: vi.fn(),
  joinTournamentRoom: vi.fn(),
  unsettledCommandCount: () => h.unsettled,
}));
vi.mock('services/transitions/activeScoringGuard', () => ({
  notifyRemoteScoringCollision: vi.fn(),
  isScoringActive: () => h.scoring,
}));
vi.mock('services/storage/saveTournamentRecord', () => ({ saveTournamentRecord: vi.fn(async () => undefined) }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('services/context', () => ({ context: {} }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { initRemoteMutationHandler, isSyncStale, markStaleNeedsRefresh, recoverIfSafe } from './remoteMutations';
import { registerRecoverySurface } from 'services/staleness/authoritativeRecovery';
import { notifyMutationApplied } from 'services/mutation/mutationObservers';
import { serverSyncAt } from 'services/staleness/serverSync';

const SERVER_AT = '2026-11-13T02:00:00.000Z';
const answer = (name = 'server') => ({
  data: { tournamentRecords: { t1: { tournamentId: 't1', tournamentName: name } }, serverUpdatedAt: { t1: SERVER_AT } },
});

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** A response the test releases, to act while the fetch is in flight. */
function deferred() {
  let release!: (value: any) => void;
  const promise = new Promise((resolve) => (release = resolve));
  return { promise, release };
}

describe('remoteMutations — guarded automatic recovery', () => {
  let dirty: boolean;
  let stopSurface: (() => void) | undefined;

  beforeEach(() => {
    h.tournamentId = 't1';
    h.setState.mockClear();
    h.requestTournament.mockReset().mockResolvedValue(answer());
    h.unsettled = 0;
    h.scoring = false;
    h.current = true;
    h.indicator = {
      style: {},
      dataset: {},
      classList: { add: vi.fn(), remove: vi.fn() },
      addEventListener: vi.fn(),
    };
    vi.stubGlobal('document', { getElementById: () => h.indicator, querySelector: () => null });
    dirty = false;
    initRemoteMutationHandler();
  });

  afterEach(() => {
    stopSurface?.();
    stopSurface = undefined;
    vi.unstubAllGlobals();
  });

  const optIn = () => (stopSurface = registerRecoverySurface(() => dirty));

  it('installs the server record without a click on a clean surface that opted in', async () => {
    optIn();
    markStaleNeedsRefresh('t1');
    await settle();

    expect(h.requestTournament).toHaveBeenCalledTimes(1);
    expect(h.setState).toHaveBeenCalledWith(answer().data.tournamentRecords.t1);
    expect(isSyncStale()).toBe(false);
    expect(serverSyncAt('t1')).toBe(Date.parse(SERVER_AT));
  });

  it('leaves every other surface to an explicit refresh', async () => {
    markStaleNeedsRefresh('t1');
    await settle();

    expect(h.requestTournament).not.toHaveBeenCalled();
    expect(isSyncStale()).toBe(true);
    expect(h.indicator.title).toBeUndefined();
  });

  it('waits for a draft, says why, and recovers once the surface settles', async () => {
    optIn();
    dirty = true;
    markStaleNeedsRefresh('t1');
    await settle();

    expect(h.requestTournament).not.toHaveBeenCalled();
    expect(isSyncStale()).toBe(true);
    expect(h.indicator.title).toBe('remoteMutations.refreshWaiting');

    dirty = false;
    recoverIfSafe();
    await settle();
    expect(h.setState).toHaveBeenCalledTimes(1);
    expect(isSyncStale()).toBe(false);
  });

  it('waits for a command still awaiting its answer, and for score entry', async () => {
    optIn();
    h.unsettled = 1;
    markStaleNeedsRefresh('t1');
    await settle();
    expect(h.requestTournament).not.toHaveBeenCalled();

    h.unsettled = 0;
    h.scoring = true;
    recoverIfSafe();
    await settle();
    expect(h.requestTournament).not.toHaveBeenCalled();
  });

  it('discards the record when a draft began while it was being fetched', async () => {
    optIn();
    const response = deferred();
    h.requestTournament.mockReturnValue(response.promise);
    markStaleNeedsRefresh('t1');
    await settle();

    dirty = true;
    response.release(answer());
    await settle();

    expect(h.setState).not.toHaveBeenCalled();
    expect(isSyncStale()).toBe(true);
  });

  // An ack or broadcast applied during the fetch may be newer than the fetched record.
  it('fetches again rather than roll back a change applied during the fetch', async () => {
    optIn();
    const first = deferred();
    h.requestTournament.mockReturnValueOnce(first.promise).mockResolvedValueOnce(answer('second'));
    markStaleNeedsRefresh('t1');
    await settle();

    notifyMutationApplied();
    first.release(answer('first'));
    await settle();

    expect(h.requestTournament).toHaveBeenCalledTimes(2);
    expect(h.setState).toHaveBeenCalledTimes(1);
    expect(h.setState.mock.calls[0][0].tournamentName).toBe('second');
  });

  it('installs nothing when the tournament changed during the fetch', async () => {
    optIn();
    const response = deferred();
    h.requestTournament.mockReturnValue(response.promise);
    markStaleNeedsRefresh('t1');
    await settle();

    h.current = false;
    response.release(answer());
    await settle();
    expect(h.setState).not.toHaveBeenCalled();
  });

  it('coalesces a burst of signals into one fetch', async () => {
    optIn();
    const response = deferred();
    h.requestTournament.mockReturnValue(response.promise);
    markStaleNeedsRefresh('t1');
    markStaleNeedsRefresh('t1');
    recoverIfSafe();
    await settle();

    response.release(answer());
    await settle();
    expect(h.requestTournament).toHaveBeenCalledTimes(1);
    expect(h.setState).toHaveBeenCalledTimes(1);
  });

  it('stays stale, with the indicator still usable, when the fetch fails', async () => {
    optIn();
    h.requestTournament.mockRejectedValue(new Error('offline'));
    markStaleNeedsRefresh('t1');
    await settle();

    expect(h.setState).not.toHaveBeenCalled();
    expect(isSyncStale()).toBe(true);
  });
});
