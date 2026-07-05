import { onTournamentContextChanged, notifyTournamentContextChanged } from './tournamentContextObservers';
import { describe, expect, it, vi } from 'vitest';

// The module holds a single `lastTournamentId` for change-detection, so each
// test uses a distinct id to stay independent of run order.
describe('tournamentContextObservers', () => {
  it('invokes a subscribed observer with the new tournamentId', () => {
    const seen: string[] = [];
    const off = onTournamentContextChanged((id) => seen.push(id));
    notifyTournamentContextChanged('obs-a');
    expect(seen).toEqual(['obs-a']);
    off();
  });

  it('does not re-fire when the same tournamentId is announced twice', () => {
    const observer = vi.fn();
    const off = onTournamentContextChanged(observer);
    notifyTournamentContextChanged('obs-b');
    notifyTournamentContextChanged('obs-b');
    expect(observer).toHaveBeenCalledTimes(1);
    off();
  });

  it('fires again when the tournamentId changes', () => {
    const observer = vi.fn();
    const off = onTournamentContextChanged(observer);
    notifyTournamentContextChanged('obs-c');
    notifyTournamentContextChanged('obs-d');
    expect(observer).toHaveBeenCalledTimes(2);
    off();
  });

  it('stops notifying after unsubscribe', () => {
    const observer = vi.fn();
    const off = onTournamentContextChanged(observer);
    off();
    notifyTournamentContextChanged('obs-e');
    expect(observer).not.toHaveBeenCalled();
  });

  it('isolates a throwing observer so the others still run', () => {
    const good = vi.fn();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const offBad = onTournamentContextChanged(() => {
      throw new Error('boom');
    });
    const offGood = onTournamentContextChanged(good);
    notifyTournamentContextChanged('obs-f');
    expect(good).toHaveBeenCalledTimes(1);
    offBad();
    offGood();
    errSpy.mockRestore();
  });
});
