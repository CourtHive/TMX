import { setDemoClockTime, advanceDemoClock, stopDemoClock, noteLoadedTournament } from './demoClock';
import { buildSchedulerDemoProfile } from 'pages/tournaments/schedulerDemoProfile';
import { clearDemoOverlay, setDemoOverlay } from 'services/demoMode/demoState';
import { notifyMutationApplied } from 'services/mutation/mutationObservers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replayDemoWalkthrough } from './replayDemoWalkthrough';
import { mocksEngine, tools } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import {
  clearDemoWalkthrough,
  getDemoWalkthrough,
  getWalkthroughStatus,
  startDemoWalkthrough,
  stopDemoWalkthrough,
} from './demoWalkthrough';

vi.mock('services/authentication/tokenManagement', () => ({ getToken: () => null }));
const RECORDED_NAME = 'Recorded walkthrough';
const START = Date.parse('2026-10-18T13:55:00Z');
const driver = {
  setTime: (time: number) => tools.setClock(() => new Date(time)),
  load: (record: any) => tournamentEngine.setState(record),
  execute: (methods: any[]) => tournamentEngine.executionQueue(methods),
  read: () => tournamentEngine.getTournament().tournamentRecord,
};

beforeEach(() => {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord(buildSchedulerDemoProfile(new Date(START)) as any);
  tournamentEngine.setState(tournamentRecord);
  noteLoadedTournament(tournamentRecord);
  setDemoOverlay({ v: 1, permissions: {} });
  expect(setDemoClockTime(START, 'clock')).toBe(true);
});
afterEach(() => {
  clearDemoWalkthrough();
  stopDemoClock();
  clearDemoOverlay();
  tools.setClock();
  tournamentEngine.reset();
});

function recordAction() {
  expect(startDemoWalkthrough()).toBe(true);
  advanceDemoClock(5);
  const methods = [{ method: 'setTournamentName', params: { tournamentName: RECORDED_NAME } }];
  expect(tournamentEngine.executionQueue(methods).error).toBeUndefined();
  notifyMutationApplied({ methods, tournamentId: tournamentEngine.getTournamentId() });
  stopDemoWalkthrough();
  return getDemoWalkthrough()!;
}

describe('demo walkthrough capture and regression replay', () => {
  it('replays actual factory commands at recorded times and verifies the resulting record', async () => {
    const capture = recordAction();
    expect(capture.steps.map((step) => step.kind)).toEqual(['clock', 'mutation']);
    expect(capture.steps[1].time).toBe(START + 300_000);
    expect(await replayDemoWalkthrough(capture, driver)).toEqual({ verified: true, steps: 2 });
    expect(driver.read()?.tournamentName).toBe(RECORDED_NAME);
  });

  it('detects a changed checkpoint rather than accepting expected state as playback', async () => {
    const capture = recordAction();
    capture.steps[1].tournament.tournamentName = 'Unexpected';
    expect(await replayDemoWalkthrough(capture, driver)).toMatchObject({
      verified: false,
      error: 'STATE_MISMATCH',
      sequence: 2,
    });
    expect(getDemoWalkthrough()!.steps[1].tournament.tournamentName).toBe(RECORDED_NAME);
  });

  it('rejects malformed captures before loading any record', async () => {
    const capture = recordAction();
    capture.steps[1].time = START - 1;
    const load = vi.fn(driver.load);
    expect(await replayDemoWalkthrough(capture, { ...driver, load })).toMatchObject({ error: 'INVALID_CAPTURE' });
    expect(load).not.toHaveBeenCalled();
  });

  it('stops on clock exit and refuses unsupported state replay', async () => {
    expect(startDemoWalkthrough()).toBe(true);
    tournamentEngine.setTournamentName({ tournamentName: 'Direct state edit' });
    notifyMutationApplied();
    stopDemoClock();
    expect(getWalkthroughStatus()).toMatchObject({ recording: false, steps: 1, stopReason: 'clock-exit' });
    expect(await replayDemoWalkthrough(getDemoWalkthrough()!, driver)).toMatchObject({
      verified: false,
      error: 'UNREPLAYABLE_STATE_STEP',
    });
  });

  it('records a route only inside the captured tournament, never one that can carry a key or token', () => {
    const tournamentId = tournamentEngine.getTournamentId();
    vi.stubGlobal('location', { hash: '#/invite/SECRET-INVITE-KEY' });
    try {
      expect(startDemoWalkthrough()).toBe(true);
      stopDemoWalkthrough();
      expect(getDemoWalkthrough()!.initialRoute).toBe('#/other');
      expect(JSON.stringify(getDemoWalkthrough())).not.toContain('SECRET-INVITE-KEY');

      clearDemoWalkthrough();
      vi.stubGlobal('location', { hash: `#/tournament/${tournamentId}/scheduling` });
      expect(startDemoWalkthrough()).toBe(true);
      stopDemoWalkthrough();
      expect(getDemoWalkthrough()!.initialRoute).toBe(`#/tournament/${tournamentId}/scheduling`);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
