import { buildSchedulerDemoProfile } from 'pages/tournaments/schedulerDemoProfile';
import { clearDemoOverlay, setDemoOverlay } from 'services/demoMode/demoState';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mocksEngine, tools } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { SCHEDULER_DEMO_ID } from './schedulingDemoScript';
import { competitionNowMs } from './competitionClock';
import { context } from 'services/context';
import {
  forgetDemoClockHistory,
  noteLoadedTournament,
  demoClockResumeAt,
  advanceDemoClock,
  canUseDemoClock,
  demoWallTime,
  getDemoClock,
  nextDemoBoundary,
  retainDemoClockFor,
  setDemoClockBusy,
  setDemoClockTime,
  stopDemoClock,
} from './demoClock';

const session = vi.hoisted(() => ({ token: null as string | null }));
vi.mock('services/authentication/tokenManagement', () => ({ getToken: () => session.token }));

const START = Date.parse('2026-10-18T13:55:00Z');
const DATE = '2026-10-18';
const ZONE = 'America/New_York';

function loadLab() {
  let result: any = mocksEngine.generateTournamentRecord(buildSchedulerDemoProfile(new Date(START)) as any);
  expect(result.error).toBeUndefined();
  tournamentEngine.setState(result.tournamentRecord);
  noteLoadedTournament(result.tournamentRecord);
}

beforeEach(() => {
  setDemoOverlay({ v: 1, permissions: {} });
});

afterEach(() => {
  clearDemoOverlay();
  stopDemoClock();
  forgetDemoClockHistory();
  session.token = null;
  context.provider = undefined;
  tournamentEngine.reset();
});

describe('paused local demo clock ownership', () => {
  it('steps TMX and factory competition and record time together; exit restores real time', () => {
    loadLab();
    expect(setDemoClockTime(START)).toBe(true);
    expect(advanceDemoClock(5)).toBe(true);
    expect(competitionNowMs()).toBe(START + 300_000);
    expect(tools.competitionNow().getTime()).toBe(START + 300_000);
    expect(tools.now().getTime()).toBe(START + 300_000);
    expect(setDemoClockTime(START)).toBe(false);
    expect(setDemoClockTime(Number.NaN)).toBe(false);
    setDemoClockBusy(true);
    expect(advanceDemoClock(15)).toBe(false);
    setDemoClockBusy(false);
    stopDemoClock();
    expect(Math.abs(competitionNowMs()! - Date.now())).toBeLessThan(1000);
    expect(Math.abs(tools.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('refuses signed-in, impersonated and provider-owned sessions', () => {
    loadLab();
    session.token = 'some-token';
    expect(canUseDemoClock()).toBe(false);
    expect(setDemoClockTime(START)).toBe(false);
    session.token = null;
    context.provider = { organisationId: 'provider' } as any;
    expect(setDemoClockTime(START)).toBe(false);
    context.provider = undefined;
    const record = tournamentEngine.getTournament().tournamentRecord!;
    const owned = { ...record, parentOrganisation: { organisationId: 'provider' } };
    tournamentEngine.setState(owned);
    noteLoadedTournament(owned);
    expect(setDemoClockTime(START)).toBe(false);
  });

  it('retains time within the demo tournament and releases it before another route', () => {
    loadLab();
    setDemoClockTime(START);
    retainDemoClockFor(SCHEDULER_DEMO_ID);
    expect(getDemoClock()?.nowMs).toBe(START);
    retainDemoClockFor('other-tournament');
    expect(getDemoClock()).toBeUndefined();
    expect(Math.abs(competitionNowMs()! - Date.now())).toBeLessThan(1000);
  });

  it('refuses time reads when identity changes before the navigation hook runs', () => {
    loadLab();
    setDemoClockTime(START);
    session.token = 'new-identity';
    expect(competitionNowMs()).toBeUndefined();
    retainDemoClockFor(SCHEDULER_DEMO_ID);
    expect(getDemoClock()).toBeUndefined();
  });

  it('releases the clock after the first refused read once another tab signs in', async () => {
    loadLab();
    setDemoClockTime(START);
    session.token = 'signed-in-elsewhere';
    expect(competitionNowMs()).toBeUndefined();
    expect(getDemoClock()).toBeDefined(); // answered at once, released after the reading call
    await Promise.resolve();
    expect(getDemoClock()).toBeUndefined();
  });

  it('a refused read with the session still anonymous keeps the clock', async () => {
    loadLab();
    setDemoClockTime(START);
    tournamentEngine.reset();
    expect(competitionNowMs()).toBeUndefined();
    await Promise.resolve();
    expect(getDemoClock()?.nowMs).toBe(START);
  });
});

describe('forward-only across Exit and reopen', () => {
  it('a reopened clock resumes at the furthest time reached, never before it', () => {
    loadLab();
    expect(demoClockResumeAt(START)).toBe(START);
    setDemoClockTime(START);
    advanceDemoClock(60 * 24 * 2); // day 3
    const furthest = START + 2 * 86_400_000;
    stopDemoClock();
    expect(getDemoClock()).toBeUndefined();
    expect(setDemoClockTime(START)).toBe(false);
    expect(demoClockResumeAt(START)).toBe(furthest);
    expect(setDemoClockTime(demoClockResumeAt(START))).toBe(true);
    expect(getDemoClock()?.nowMs).toBe(furthest);
  });

  it('a later first-day start than the furthest time wins', () => {
    loadLab();
    setDemoClockTime(START);
    stopDemoClock();
    expect(demoClockResumeAt(START + 60_000)).toBe(START + 60_000);
  });

  it('a regenerated record starts over', () => {
    loadLab();
    setDemoClockTime(START + 86_400_000);
    stopDemoClock();
    forgetDemoClockHistory(SCHEDULER_DEMO_ID);
    expect(demoClockResumeAt(START)).toBe(START);
    expect(setDemoClockTime(START)).toBe(true);
  });
});

describe('demo time boundaries', () => {
  it('chooses the first strictly future threshold in venue time, including maintenance', () => {
    const matchUps = [{ schedule: { scheduledDate: DATE, scheduledTime: '10:00' } }];
    const venues = [
      { courts: [{ dateAvailability: [{ date: DATE, bookings: [{ startTime: '10:02', endTime: '10:10' }] }] }] },
    ];
    const first = nextDemoBoundary(START, matchUps, venues, ZONE)!;
    expect(first).toEqual({ at: START + 300_000, kind: 'scheduled' });
    const next = nextDemoBoundary(first.at, matchUps, venues, ZONE)!;
    expect(next.kind).toBe('blockStart');
    expect(nextDemoBoundary(next.at, matchUps, venues, ZONE)?.kind).toBe('blockEnd');
    expect(nextDemoBoundary(START + 3600_000, matchUps, venues, ZONE)).toBeUndefined();
  });

  it('rejects invalid calendar dates and nonexistent DST times', () => {
    expect(demoWallTime('2026-02-30', '10:00', ZONE)).toBeUndefined();
    expect(demoWallTime('2026-03-08', '02:30', ZONE)).toBeUndefined();
    expect(demoWallTime(DATE, '09:55', ZONE)).toBe(START);
  });
});
