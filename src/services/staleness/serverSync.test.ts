import { beforeEach, describe, expect, it, vi } from 'vitest';

// P49: the tab's sync point per tournament — the server write its copy is known to be current at.
describe('serverSync', () => {
  let sync: typeof import('./serverSync');
  const T = 't1';
  const at = (minute: number) => `2026-10-08T19:${String(minute).padStart(2, '0')}:00.000Z`;
  const step = (from: number, to: number) => [{ [T]: at(from) }, { [T]: at(to) }] as const;

  beforeEach(async () => {
    vi.resetModules();
    sync = await import('./serverSync');
  });

  it('a full load sets the sync point; the probe compares the server against it', () => {
    sync.setServerSync(T, at(10));
    expect(sync.serverIsAhead(T, at(10))).toBe(false);
    expect(sync.serverIsAhead(T, at(11))).toBe(true);
  });

  it('cannot judge without a sync point or a server value, and does not guess', () => {
    expect(sync.serverIsAhead(T, at(10))).toBeUndefined();
    sync.setServerSync(T, at(10));
    expect(sync.serverIsAhead(T, undefined)).toBeUndefined();
    sync.setServerSync(T, undefined); // a local copy replaces it
    expect(sync.serverIsAhead(T, at(11))).toBeUndefined();
  });

  it('a mutation applied from the sync point moves it to that mutation’s write', () => {
    sync.setServerSync(T, at(10));
    sync.advanceServerSync(...step(10, 11));
    expect(sync.serverIsAhead(T, at(11))).toBe(false);
  });

  // The case a plain "take the newest time" would get wrong: this tab missed 10→11 and then made its
  // own edit 11→12. Taking 12 would hide the missed write for good.
  it('stays behind after a missed write, even when its own later edit is acked', () => {
    sync.setServerSync(T, at(10));
    sync.advanceServerSync(...step(11, 12));
    expect(sync.serverIsAhead(T, at(12))).toBe(true);
  });

  // An ack arrives over HTTP, a broadcast over the socket: they can swap.
  it('chains steps that arrive out of order once the gap closes', () => {
    sync.setServerSync(T, at(10));
    sync.advanceServerSync(...step(12, 13));
    sync.advanceServerSync(...step(11, 12));
    expect(sync.serverIsAhead(T, at(13))).toBe(true); // 10→11 still missing
    sync.advanceServerSync(...step(10, 11));
    expect(sync.serverIsAhead(T, at(13))).toBe(false);
  });

  it('never moves backward on a late or repeated step', () => {
    sync.setServerSync(T, at(15));
    sync.advanceServerSync(...step(10, 11));
    expect(sync.serverSyncAt(T)).toBe(Date.parse(at(15)));
  });

  it('ignores a step without its previous write (a server that does not report it)', () => {
    sync.setServerSync(T, at(10));
    sync.advanceServerSync(undefined, { [T]: at(11) });
    expect(sync.serverIsAhead(T, at(11))).toBe(true);
  });

  it('sets every tournament a save answer reports', () => {
    sync.setServerSyncFrom({ t1: at(10), t2: at(20) });
    expect(sync.serverSyncAt('t2')).toBe(Date.parse(at(20)));
  });
});
