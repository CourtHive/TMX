/**
 * "Now" at the competition, for TMX's scheduling decisions: the venue's today and clock, due marks,
 * auto-call, call stamps and rest. Slice 0-d.3 of Mentat/planning/COMPETITION_CLOCK_INSTRUMENTATION.md.
 *
 * One seam so a demo can move every one of those together. With no provider installed (production)
 * it is the device's wall clock, exactly as before. `setCompetitionClock({ nowMs })` installs one;
 * no argument removes it. It is synchronous and numeric, the same contract as the factory's
 * `setCompetitionClock`, so binding the two is a one-line change once a factory release carries it.
 *
 * NOT for operational time: socket heartbeats, token expiry, toasts, debounce and other timers keep
 * reading the real clock directly. A frozen competition clock must never stall the app.
 *
 * Supported for demos only as the plan's activation gate allows: local-only, or a clock held at one
 * paused instant. A competition clock that moves while server-first mutations are in flight is not.
 */
type CompetitionTimeProvider = { nowMs(): number };
type ClockListener = () => void;

let provider: CompetitionTimeProvider | undefined;
let warned = false;

const listeners = new Set<ClockListener>();
let notifyScheduled = false;

// one frame per burst of changes; Node (the unit tests) has no requestAnimationFrame
const nextFrame = (callback: () => void): void => {
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(() => callback());
  else setTimeout(callback, 0);
};

function notifyChange(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  nextFrame(() => {
    notifyScheduled = false;
    // a listener disposed while the frame was pending is gone from the set, so it is never called
    for (const listener of [...listeners]) listener();
  });
}

/**
 * Run `listener` after the competition clock is installed, moved or removed, so every visible surface
 * that reads it refreshes at once instead of on its next timer. Changes are coalesced: any number of
 * them before the next frame produce ONE call. Returns the disposer.
 */
export function onCompetitionClockChange(listener: ClockListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCompetitionClock(next?: CompetitionTimeProvider): { success?: boolean; error?: string } {
  if (next !== undefined && typeof next?.nowMs !== 'function') return { error: 'INVALID_VALUES' };
  provider = next;
  warned = false;
  notifyChange();
  return { success: true };
}

/**
 * The competition's current instant in epoch ms, or `undefined` when the installed clock cannot give
 * one (it threw, or answered something that is not a representable instant). NEVER the device clock in its place: a
 * simulation that silently fell back to real time would schedule, call and stamp on today's date
 * (CA, 2026-10-13). Callers treat `undefined` as "no clock" and refuse the time-dependent action.
 * The failure is logged once per installed clock (A2: surfaced, not a warning per read).
 */
export function competitionNowMs(): number | undefined {
  if (!provider) return Date.now();
  let ms: unknown;
  try {
    ms = provider.nowMs();
  } catch {
    // a provider that throws is a provider that gave no instant: refused the same way, not propagated
    ms = undefined;
  }
  if (typeof ms === 'number' && !Number.isNaN(new Date(ms).getTime())) return ms;
  if (!warned) {
    warned = true;
    console.warn(
      '[competitionClock] the installed clock returned no usable instant; time-dependent actions are refused',
    );
  }
  return undefined;
}

/**
 * The competition's current instant as a Date: an INVALID Date when the clock cannot give one, which
 * every venue helper already reads as "no time" (blank clocks, no today, no Now-strip instant). Never
 * call `toISOString()` on it unguarded; use `competitionNowMs()` where an instant must be written.
 */
export function competitionNow(): Date {
  return new Date(competitionNowMs() ?? Number.NaN);
}
