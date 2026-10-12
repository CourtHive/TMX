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

let provider: CompetitionTimeProvider | undefined;
let warned = false;

export function setCompetitionClock(next?: CompetitionTimeProvider): { success?: boolean; error?: string } {
  if (next !== undefined && typeof next?.nowMs !== 'function') return { error: 'INVALID_VALUES' };
  provider = next;
  warned = false;
  return { success: true };
}

/**
 * The competition's current instant. A provider that answers with something that is not a finite
 * number is ignored for that read, and the wall clock answers instead: a broken demo control must
 * not take the running desk down with it. That fallback is logged once per installed clock (A2: surfaced,
 * not silent, and not a warning per read).
 */
export function competitionNow(): Date {
  if (!provider) return new Date();
  const ms = provider.nowMs();
  if (typeof ms === 'number' && Number.isFinite(ms)) return new Date(ms);
  if (!warned) {
    warned = true;
    console.warn('[competitionClock] the installed clock returned a non-finite instant; using the device clock');
  }
  return new Date();
}
