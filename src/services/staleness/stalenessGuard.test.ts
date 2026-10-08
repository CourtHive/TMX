import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// P49: the probe compares the server's write time with this tab's sync point. It used to compare the
// record's own updatedAt, which almost no record has, so the server answered null and it never fired.
const h = vi.hoisted(() => ({
  probe: vi.fn(),
  markStale: vi.fn(),
  record: { tournamentId: 't1' } as any,
}));

vi.mock('services/messaging/socketIo', () => ({
  hadDisconnect: () => false,
  clearDisconnectFlag: vi.fn(),
  onSocketReconnect: vi.fn(),
}));
vi.mock('services/messaging/remoteMutations', () => ({
  markStaleNeedsRefresh: (id: string) => h.markStale(id),
  isSyncStale: () => false,
}));
vi.mock('services/apis/servicesApi', () => ({ requestTournamentUpdatedAt: (p: any) => h.probe(p) }));
vi.mock('services/authentication/loginState', () => ({ getLoginState: () => ({ email: 'td@x.com' }) }));
vi.mock('services/factory/engine', () => ({
  tournamentEngine: { getTournament: () => ({ tournamentRecord: h.record }), q: { tournament: () => h.record } },
}));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));

describe('the staleness probe', () => {
  let guard: typeof import('./stalenessGuard');
  let sync: typeof import('./serverSync');
  const T = 't1';
  const at = (minute: number) => `2026-10-08T19:${String(minute).padStart(2, '0')}:00.000Z`;
  const answer = (data: any) => h.probe.mockResolvedValue({ data });

  beforeEach(async () => {
    vi.useFakeTimers();
    h.probe.mockReset();
    h.markStale.mockReset();
    h.record = { tournamentId: T };
    vi.resetModules();
    guard = await import('./stalenessGuard');
    sync = await import('./serverSync');
  });

  afterEach(() => vi.useRealTimers());

  const probe = async () => {
    guard.triggerStalenessCheck();
    await vi.advanceTimersByTimeAsync(guard.STALE_GRACE_MS + 10);
  };

  it('flags a tab the server has a write it never applied', async () => {
    sync.setServerSync(T, at(10));
    answer({ serverUpdatedAt: at(11), updatedAt: null });
    await probe();
    expect(h.markStale).toHaveBeenCalledWith(T);
  });

  it('leaves a current tab alone', async () => {
    sync.setServerSync(T, at(11));
    answer({ serverUpdatedAt: at(11), updatedAt: null });
    await probe();
    expect(h.markStale).not.toHaveBeenCalled();
  });

  it('waits out a write whose ack or broadcast is still arriving', async () => {
    sync.setServerSync(T, at(10));
    answer({ serverUpdatedAt: at(11), updatedAt: null });
    guard.triggerStalenessCheck();
    await vi.advanceTimersByTimeAsync(10);
    sync.advanceServerSync({ [T]: at(10) }, { [T]: at(11) }); // the broadcast lands inside the grace
    await vi.advanceTimersByTimeAsync(guard.STALE_GRACE_MS);
    expect(h.markStale).not.toHaveBeenCalled();
  });

  it('cannot judge a copy with no sync point, and does what it did before', async () => {
    answer({ serverUpdatedAt: at(11), updatedAt: null });
    await probe();
    expect(h.markStale).not.toHaveBeenCalled();
  });

  it('keeps the old comparison for a server that does not report serverUpdatedAt', async () => {
    h.record = { tournamentId: T, updatedAt: at(10) };
    answer({ updatedAt: at(11) });
    await probe();
    expect(h.markStale).toHaveBeenCalledWith(T);
  });
});
