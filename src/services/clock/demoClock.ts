import { hasSchedulingDemoScript, isDemoTournament } from 'pages/tournaments/schedulerDemoProfile';
import { venueCalendarDate, venueClock, venueWallClockToMs } from 'functions/venueTimeFrame';
import { isDemoActive, onDemoOverlayChange } from 'services/demoMode/demoState';
import { getToken } from 'services/authentication/tokenManagement';
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
 * The record the clock may run on: a demo tournament (guided lab or demo copy) with no provider, alone in the
 * engine. The clock stamps simulated times into whatever it runs on, so a real tournament never qualifies; free
 * clock on a real local tournament runs on a demo copy of it (demoClockLauncher).
 */
export function isDemoClockEligible(): boolean {
  if (!isDemoClockSessionEligible()) return false;
  const record = tournamentEngine.getTournament().tournamentRecord;
  return (
    !!record?.tournamentId &&
    isDemoTournament(record) &&
    !record.parentOrganisation?.organisationId &&
    Object.values(tournamentEngine.getState().tournamentRecords ?? {}).every(
      (entry: any) => entry.tournamentId === record.tournamentId,
    )
  );
}

/** Eligibility alone is insufficient: the demo posture must also be active. */
export function canUseDemoClock(): boolean {
  return isDemoActive() && isDemoClockEligible();
}

/**
 * Read on every competition-time lookup (the factory reads it once per engine call), so it checks only cheap facts
 * and never copies the record: the session is still anonymous, demo posture is on, and the loaded tournament is the
 * one the clock was set on. Ownership of that record was checked when the clock was set (setDemoClockTime).
 */
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
  // Stored calls and results cannot be undone by winding a clock back.
  if (state && nowMs < state.nowMs) return false;
  const record = tournamentEngine.getTournament().tournamentRecord!;
  const nextMode = mode ?? state?.mode ?? (hasSchedulingDemoScript(record) ? 'script' : 'clock');
  if (nextMode === 'script' && !hasSchedulingDemoScript(record)) return false;
  state = { tournamentId: record.tournamentId!, nowMs, busy: false, mode: nextMode };
  // Reinstall to notify every existing scheduling subscriber, coalesced by competitionClock.
  setCompetitionClock({ nowMs: () => (clockApplies() ? (state?.nowMs ?? Number.NaN) : Number.NaN) });
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
