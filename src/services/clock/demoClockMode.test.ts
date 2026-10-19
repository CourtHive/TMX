import { buildSchedulerDemoProfile } from 'pages/tournaments/schedulerDemoProfile';
import { clearDemoOverlay, setDemoOverlay } from 'services/demoMode/demoState';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mocksEngine, tools } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { competitionNowMs } from './competitionClock';
import {
  canUseDemoClock,
  getDemoClock,
  isDemoClockEligible,
  noteLoadedTournament,
  setDemoClockTime,
  stopDemoClock,
} from './demoClock';

const identity = vi.hoisted(() => ({ token: null as string | null }));
vi.mock('services/authentication/tokenManagement', () => ({ getToken: () => identity.token }));

const INSTANT = Date.parse('2026-10-18T14:00:00Z');

beforeEach(() => {
  clearDemoOverlay();
  let result: any = mocksEngine.generateTournamentRecord(buildSchedulerDemoProfile(new Date(INSTANT)) as any);
  expect(result.error).toBeUndefined();
  tournamentEngine.setState(result.tournamentRecord);
  noteLoadedTournament(result.tournamentRecord);
});

afterEach(() => {
  stopDemoClock();
  clearDemoOverlay();
  identity.token = null;
  tournamentEngine.reset();
});

describe('clock control requires an explicit anonymous demo session', () => {
  it('refuses control outside demo mode even for the local example', () => {
    expect(isDemoClockEligible()).toBe(true);
    expect(canUseDemoClock()).toBe(false);
    expect(setDemoClockTime(INSTANT)).toBe(false);
  });

  it('releases both clock roles immediately when demo mode exits', () => {
    setDemoOverlay({ v: 1, permissions: {} });
    expect(setDemoClockTime(INSTANT)).toBe(true);
    clearDemoOverlay();
    expect(getDemoClock()).toBeUndefined();
    expect(Math.abs(competitionNowMs()! - Date.now())).toBeLessThan(1000);
    expect(Math.abs(tools.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('never admits a signed-in superadmin even with an active demo overlay', () => {
    identity.token = `header.${btoa(JSON.stringify({ roles: ['superadmin'] }))}.signature`;
    setDemoOverlay({ v: 1, permissions: {} });
    expect(isDemoClockEligible()).toBe(false);
    expect(canUseDemoClock()).toBe(false);
    expect(setDemoClockTime(INSTANT)).toBe(false);
  });

  it('never runs on a real local tournament: only a demo tournament (the Scheduling Lab) qualifies', () => {
    const plain: any = mocksEngine.generateTournamentRecord({ tournamentName: 'My local event' });
    tournamentEngine.setState(plain.tournamentRecord);
    noteLoadedTournament(plain.tournamentRecord);
    setDemoOverlay({ v: 1, permissions: {} });
    expect(isDemoClockEligible()).toBe(false);
    expect(setDemoClockTime(INSTANT)).toBe(false);
  });

  it('eligibility never copies the record: it reads only the engine tournament id', () => {
    setDemoOverlay({ v: 1, permissions: {} });
    const getTournament = vi.spyOn(tournamentEngine, 'getTournament');
    const getState = vi.spyOn(tournamentEngine, 'getState');
    expect(isDemoClockEligible()).toBe(true);
    expect(setDemoClockTime(INSTANT)).toBe(true);
    expect(competitionNowMs()).toBe(INSTANT);
    expect(getTournament).not.toHaveBeenCalled();
    expect(getState).not.toHaveBeenCalled();
    getTournament.mockRestore();
    getState.mockRestore();
  });

  it('demo time applies only while the tournament it was set on is the loaded one', () => {
    setDemoOverlay({ v: 1, permissions: {} });
    expect(setDemoClockTime(INSTANT)).toBe(true);
    expect(competitionNowMs()).toBe(INSTANT);
    const other: any = mocksEngine.generateTournamentRecord({ tournamentName: 'Another record' });
    tournamentEngine.setState(other.tournamentRecord);
    noteLoadedTournament(other.tournamentRecord);
    // The provider withholds demo time (NaN, which the factory refuses) rather than lend it to another record; the
    // router releases the clock on navigation (retainDemoClockFor).
    expect(competitionNowMs()).not.toBe(INSTANT);
  });
});
