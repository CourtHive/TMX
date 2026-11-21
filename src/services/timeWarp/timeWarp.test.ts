import { afterEach, describe, expect, it, vi } from 'vitest';
import { tournamentEngine } from 'services/factory/engine';
import { mocksEngine } from 'tods-competition-factory';
import { initializeTimeWarp, enterTimeWarp, exitTimeWarp, type WarpHost } from './timeWarp';
import { registerWarpParticipant } from './warpParticipants';
import { getWarpSession } from './warpState';
import { networkIsIsolated } from 'services/network/networkPolicy';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  tournamentEngine.reset();
  vi.unstubAllGlobals();
});

function setup() {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({ tournamentName: 'Production' });
  tournamentRecord.isMock = false;
  tournamentEngine.setState(tournamentRecord);
  const path = `#/tournament/${tournamentRecord.tournamentId}/scheduling`;
  vi.stubGlobal('location', { hash: path });
  const owner: WarpHost = {
    path: () => path.slice(1),
    ready: () => true,
    refused: vi.fn(),
    prepare: async () => ({}),
    capture: () => ({}),
    beforeEnter: vi.fn(),
    entered: vi.fn(),
    beforeExit: vi.fn(),
    restored: vi.fn((_session, _options, complete) => complete()),
  };
  dispose = initializeTimeWarp(owner);
  return { owner, tournamentRecord };
}

describe('page-independent Warp lifecycle', () => {
  it('takes one snapshot, isolates a mock copy, and restores the unchanged source through registered owners', async () => {
    const { tournamentRecord, owner } = setup();
    const snapshot = vi.spyOn(tournamentEngine, 'getState');
    const getTournament = vi.spyOn(tournamentEngine, 'getTournament');
    const switchOwner = vi.fn();
    const off = registerWarpParticipant({ beforeSwitch: switchOwner });
    expect(await enterTimeWarp()).toBe(true);
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(getTournament).not.toHaveBeenCalled();
    expect(networkIsIsolated()).toBe(true);
    expect(tournamentEngine.q.tournament()?.isMock).toBe(true);
    expect(tournamentEngine.getTournamentId()).not.toBe(tournamentRecord.tournamentId);
    exitTimeWarp();
    expect(tournamentEngine.q.tournament()).toEqual(tournamentRecord);
    expect(networkIsIsolated()).toBe(false);
    expect(switchOwner.mock.calls).toEqual([['enter'], ['exit']]);
    expect(owner.restored).toHaveBeenCalled();
    off();
    snapshot.mockRestore();
    getTournament.mockRestore();
  });

  it('keeps isolation until asynchronous restoration finishes and lets auth abandon a pending return', async () => {
    const { owner } = setup();
    let finish!: () => void;
    owner.restored = (_session, _options, complete) =>
      new Promise<void>((resolve) => {
        finish = () => {
          complete();
          resolve();
        };
      });
    await enterTimeWarp();
    const copy = getWarpSession();
    exitTimeWarp();
    expect(getWarpSession()).toBe(copy);
    expect(networkIsIsolated()).toBe(true);
    finish();
    expect(getWarpSession()).toBeUndefined();
    expect(networkIsIsolated()).toBe(false);
    await enterTimeWarp();
    exitTimeWarp();
    exitTimeWarp({ navigate: false });
    expect(getWarpSession()).toBeUndefined();
    finish();
    expect(networkIsIsolated()).toBe(false);
  });

  it('rechecks page guards and selection after prepare, and importing it alone starts nothing', async () => {
    const { owner } = setup();
    let dirty = false;
    const off = registerWarpParticipant({ canEnter: () => !dirty });
    owner.prepare = async () => {
      dirty = true;
      return {};
    };
    expect(await enterTimeWarp()).toBe(false);
    expect(getWarpSession()).toBeUndefined();
    expect(networkIsIsolated()).toBe(false);
    off();
  });
});

it.each(['beforeExit', 'restored', 'async-restored', 'participant'])(
  'releases isolation and permits another entry after %s fails',
  async (stage) => {
    const { owner, tournamentRecord } = setup();
    owner.failed = vi.fn();
    const failure = new Error('restore probe');
    const off = registerWarpParticipant({
      beforeSwitch: (phase) => {
        if (phase === 'exit' && stage === 'participant') throw failure;
      },
    });
    await enterTimeWarp();
    if (stage === 'beforeExit')
      owner.beforeExit = () => {
        throw failure;
      };
    if (stage === 'restored')
      owner.restored = () => {
        throw failure;
      };
    if (stage === 'async-restored')
      owner.restored = async () => {
        throw failure;
      };
    exitTimeWarp();
    await vi.waitFor(() => expect(getWarpSession()).toBeUndefined());
    expect(networkIsIsolated()).toBe(false);
    expect(tournamentEngine.getTournamentId()).toBe(tournamentRecord.tournamentId);
    expect(owner.failed).toHaveBeenCalledWith(expect.anything(), failure);
    off();
    owner.beforeExit = () => undefined;
    owner.restored = (_session, _options, complete) => complete();
    expect(await enterTimeWarp()).toBe(true);
  },
);
