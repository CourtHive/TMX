import { notifyTournamentContextChanged } from 'services/tournament/tournamentContextObservers';
import { notifyMutationApplied } from 'services/mutation/mutationObservers';
import { dropPassValues, readOncePerPass } from './renderPass';
import { describe, expect, it, vi } from 'vitest';

const nextMicrotask = () => Promise.resolve();

describe('readOncePerPass', () => {
  it('reads once and shares the value across one synchronous pass', async () => {
    const read = vi.fn(() => ({ events: ['e1'] }));
    const first = readOncePerPass('events', read);
    const second = readOncePerPass('events', read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    await nextMicrotask();
  });

  it('keeps keys apart', async () => {
    const events = vi.fn(() => 'events');
    const publishState = vi.fn(() => 'publishState');
    expect(readOncePerPass('events', events)).toBe('events');
    expect(readOncePerPass('publishState', publishState)).toBe('publishState');
    expect(events).toHaveBeenCalledTimes(1);
    expect(publishState).toHaveBeenCalledTimes(1);
    await nextMicrotask();
  });

  it('reads again in the next pass, so nothing outlives the render that asked', async () => {
    let version = 1;
    const read = vi.fn(() => version);
    expect(readOncePerPass('version', read)).toBe(1);
    version = 2;
    expect(readOncePerPass('version', read)).toBe(1);
    await nextMicrotask();
    expect(readOncePerPass('version', read)).toBe(2);
    expect(read).toHaveBeenCalledTimes(2);
    await nextMicrotask();
  });

  it('drops the pass when a mutation is applied mid-pass', async () => {
    let version = 1;
    const read = () => version;
    expect(readOncePerPass('afterMutation', read)).toBe(1);
    version = 2;
    notifyMutationApplied();
    expect(readOncePerPass('afterMutation', read)).toBe(2);
    await nextMicrotask();
  });

  it('drops the pass when the tournament changes mid-pass', async () => {
    let tournamentId = 't1';
    const read = () => tournamentId;
    expect(readOncePerPass('tournament', read)).toBe('t1');
    tournamentId = 't2';
    notifyTournamentContextChanged('t2');
    expect(readOncePerPass('tournament', read)).toBe('t2');
    await nextMicrotask();
  });

  it('a value that is undefined is still read once', async () => {
    const read = vi.fn(() => undefined);
    readOncePerPass('nothing', read);
    readOncePerPass('nothing', read);
    expect(read).toHaveBeenCalledTimes(1);
    await nextMicrotask();
  });

  it('dropPassValues drops the pass at once, for a reset that must read fresh in the same task', async () => {
    let version = 1;
    const read = () => version;
    expect(readOncePerPass('reset', read)).toBe(1);
    version = 2;
    dropPassValues();
    expect(readOncePerPass('reset', read)).toBe(2);
    await nextMicrotask();
  });
});
