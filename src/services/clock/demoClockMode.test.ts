import { canUseDemoClock, getDemoClock, isDemoClockEligible, setDemoClockTime, stopDemoClock } from './demoClock';
import { buildSchedulerDemoProfile } from 'pages/tournaments/schedulerDemoProfile';
import { clearDemoOverlay, setDemoOverlay } from 'services/demoMode/demoState';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mocksEngine, tools } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { competitionNowMs } from './competitionClock';

const identity = vi.hoisted(() => ({ token: null as string | null }));
vi.mock('services/authentication/tokenManagement', () => ({ getToken: () => identity.token }));

const INSTANT = Date.parse('2026-10-18T14:00:00Z');

beforeEach(() => {
  clearDemoOverlay();
  let result: any = mocksEngine.generateTournamentRecord(buildSchedulerDemoProfile(new Date(INSTANT)) as any);
  expect(result.error).toBeUndefined();
  tournamentEngine.setState(result.tournamentRecord);
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
});
