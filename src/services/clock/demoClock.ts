import { venueCalendarDate, venueClock, venueWallClockToMs } from 'functions/venueTimeFrame';
import { isDemoActive, onDemoOverlayChange } from 'services/demoMode/demoState';
import { getToken } from 'services/authentication/tokenManagement';
import { hasSchedulingDemoScript } from './schedulingDemoScript';
import { getJwtTokenStorageKey } from 'config/localStorage';
import { tournamentEngine } from 'services/factory/engine';
import { setCompetitionClock } from './competitionClock';
import { context } from 'services/context';

export type DemoClockMode = 'clock' | 'script';
type DemoClockState = { tournamentId: string; nowMs: number; busy: boolean; mode: DemoClockMode };
let state: DemoClockState | undefined;
const listeners = new Set<() => void>();

function signedIn(): boolean {
  try {
    return !!getToken();
  } catch {
    return true; // storage unreadable: cannot prove the session is anonymous
  }
}

/** Eligibility to enter clock control; no signed-in identity, including super-admins. */
export function isDemoClockSessionEligible(): boolean {
  return !signedIn() && !context.provider;
}

/**
 * Demo tournaments seen loading, by id. The clock only ever runs on a demo tournament (the Scheduling Lab), and the
 * engine cannot hand out a record without deep-copying it, so the clock never reads the record: TMX notes a demo
 * tournament's id and start date from the plain record it already holds while loading it (`loadTournament`), and
 * every check below is a lookup of the engine's current tournament id.
 */
const demoTournaments = new Map<string, { startDate: string }>();

/** Called with the record being loaded; notes it only if it is a demo tournament with no provider. */
export function noteLoadedTournament(record: any): void {
  const tournamentId = record?.tournamentId;
  if (!tournamentId) return;
  if (hasSchedulingDemoScript(record) && !record.parentOrganisation?.organisationId && record.startDate)
    demoTournaments.set(tournamentId, { startDate: record.startDate });
  else demoTournaments.delete(tournamentId);
}

/** The loaded demo tournament's start date, or undefined when the loaded tournament is not a demo tournament. */
export function demoTournamentStartDate(): string | undefined {
  return demoTournaments.get(tournamentEngine.getTournamentId())?.startDate;
}

/** The loaded tournament is a demo tournament and nobody is signed in. */
export function isDemoClockEligible(): boolean {
  return isDemoClockSessionEligible() && demoTournaments.has(tournamentEngine.getTournamentId());
}

/** Eligibility alone is insufficient: the demo posture must also be active. */
export function canUseDemoClock(): boolean {
  return isDemoActive() && isDemoClockEligible();
}

/** Read on every competition-time lookup (the factory reads it once per engine call): id comparisons only. */
function clockApplies(): boolean {
  return (
    !!state &&
    isDemoClockSessionEligible() &&
    isDemoActive() &&
    tournamentEngine.getTournamentId() === state.tournamentId
  );
}

onDemoOverlayChange(() => {
  if (!canUseDemoClock()) stopDemoClock();
});

/**
 * A sign-in in another tab shares the token through localStorage. Without this the demo tab would keep its panel up
 * while every factory call is refused for an unusable clock (NaN), with no reason given.
 */
function releaseIfSessionChanged(): void {
  if (state && !isDemoClockSessionEligible()) stopDemoClock();
}

if (typeof globalThis.addEventListener === 'function')
  globalThis.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === null || event.key === getJwtTokenStorageKey()) releaseIfSessionChanged();
  });

let releaseQueued = false;
/** A refused read is answered with NaN at once; the release itself runs after the engine call that read it. */
function queueSessionRelease(): void {
  if (releaseQueued) return;
  releaseQueued = true;
  queueMicrotask(() => {
    releaseQueued = false;
    releaseIfSessionChanged();
  });
}

function readDemoNow(): number {
  if (clockApplies()) return state?.nowMs ?? Number.NaN;
  queueSessionRelease();
  return Number.NaN;
}

/**
 * The furthest time each demo tournament's clock has reached. Calls and results stamped up to it are in the record,
 * so it outlives `state`: Exit and route changes stop the clock, and a reopened clock resumes from here instead of
 * winding back under those stamps.
 */
const highWater = new Map<string, number>();

/** Where a (re)opened clock may start for the loaded tournament: `startMs`, or later if the clock already ran past it. */
export function demoClockResumeAt(startMs: number): number {
  return Math.max(startMs, highWater.get(tournamentEngine.getTournamentId()) ?? startMs);
}

/** The tournament's record was regenerated, so none of its earlier stamps remain. No id forgets every tournament. */
export function forgetDemoClockHistory(tournamentId?: string): void {
  if (tournamentId) highWater.delete(tournamentId);
  else highWater.clear();
}

export function getDemoClock(): Readonly<DemoClockState> | undefined {
  return state ? { ...state } : undefined;
}

export function onDemoClockChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changed(): void {
  for (const listener of listeners) listener();
}

export function stopDemoClock(): void {
  if (!state) return;
  state = undefined;
  setCompetitionClock();
  changed();
}

/** Route hooks call this BEFORE another tournament is loaded or a page is rendered. */
export function retainDemoClockFor(tournamentId?: string): void {
  if (state && (state.tournamentId !== tournamentId || !canUseDemoClock())) stopDemoClock();
}

export function setDemoClockTime(nowMs: number, mode?: DemoClockMode): boolean {
  if (!canUseDemoClock() || state?.busy || !Number.isFinite(nowMs) || Number.isNaN(new Date(nowMs).getTime()))
    return false;
  const tournamentId = tournamentEngine.getTournamentId();
  // Stored calls and results cannot be undone by winding a clock back, including by exiting and reopening it.
  const floor = Math.max(
    state?.nowMs ?? Number.NEGATIVE_INFINITY,
    highWater.get(tournamentId) ?? Number.NEGATIVE_INFINITY,
  );
  if (nowMs < floor) return false;
  const nextMode = mode ?? state?.mode ?? 'script';
  state = { tournamentId, nowMs, busy: false, mode: nextMode };
  highWater.set(tournamentId, nowMs);
  // Reinstall to notify every existing scheduling subscriber, coalesced by competitionClock.
  setCompetitionClock({ nowMs: readDemoNow });
  changed();
  return true;
}

export function setDemoClockBusy(busy: boolean): void {
  if (state) {
    state = { ...state, busy };
    changed();
  }
}

export function advanceDemoClock(minutes: number): boolean {
  return !!state && minutes > 0 && setDemoClockTime(state.nowMs + minutes * 60_000);
}

export type DemoBoundary = { at: number; kind: 'scheduled' | 'blockStart' | 'blockEnd' };

/** No synthetic match history: these are observable time thresholds, not scripted outcomes. */
export function nextDemoBoundary(
  nowMs: number,
  matchUps: any[],
  venues: any[],
  timeZone: string,
): DemoBoundary | undefined {
  const candidates: DemoBoundary[] = [];
  const add = (date: string, time: string, kind: DemoBoundary['kind']) => {
    const at = venueWallClockToMs(date, time, timeZone);
    if (at !== undefined && at > nowMs) candidates.push({ at, kind });
  };
  for (const matchUp of matchUps) {
    const schedule = matchUp.schedule;
    if (schedule?.scheduledDate && schedule.scheduledTime && !matchUp.winningSide)
      add(schedule.scheduledDate, schedule.scheduledTime, 'scheduled');
  }
  for (const venue of venues) {
    for (const court of venue.courts ?? []) {
      for (const day of court.dateAvailability ?? []) {
        for (const booking of day.bookings ?? []) {
          add(day.date, booking.startTime, 'blockStart');
          add(day.date, booking.endTime, 'blockEnd');
        }
      }
    }
  }
  return candidates.toSorted((a, b) => a.at - b.at)[0];
}

/** Reject normalized invalid dates and DST gaps rather than stepping to a different wall clock. */
export function demoWallTime(date: string, time: string, timeZone: string): number | undefined {
  const at = venueWallClockToMs(date, time, timeZone);
  return at !== undefined && venueCalendarDate(at, timeZone) === date && venueClock(at, timeZone) === time
    ? at
    : undefined;
}
