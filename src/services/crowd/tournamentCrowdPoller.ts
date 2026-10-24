/**
 * One crowd-activity poll per open tournament.
 *
 * The poll used to start only when the matchUps table mounted, so the draw view
 * — where a TD actually watches matches — never had crowd data unless that tab
 * had been visited first. The tournament owns the poll now; every view reads
 * `crowdActivityIndex`, and `onChange` lets the active view re-render once per
 * poll tick that moved anything.
 *
 * A promoted session is a feed the TD chose to follow, and its score is shown in
 * the bracket. The 45 s cadence is fine for "is anyone scoring?" but too slow to
 * follow a match, so the poll also runs every `TRUSTED_INTERVAL_MS` while any
 * session is promoted.
 */
import { hasTrustedSessions, setActiveCountsFromSnapshot, subscribeCrowdActivity } from './crowdActivityIndex';
import { startCrowdPoller, type CrowdPoller } from './crowdPoller';

let poller: CrowdPoller | undefined;
let pollerTournamentId: string | undefined;
let unsubscribe: (() => void) | undefined;
let fastTimer: ReturnType<typeof setInterval> | undefined;

export const TRUSTED_INTERVAL_MS = 10_000;

function syncFastPoll(): void {
  const want = !!poller && hasTrustedSessions();
  if (want && !fastTimer) {
    fastTimer = setInterval(() => void poller?.runOnce(), TRUSTED_INTERVAL_MS);
  } else if (!want && fastTimer) {
    clearInterval(fastTimer);
    fastTimer = undefined;
  }
}

/**
 * Start polling for this tournament; a no-op when it is already the one being
 * polled. `onChange` runs at most once per poll tick, after every changed
 * matchUp has been notified.
 */
export function startTournamentCrowdPoller(tournamentId: string, onChange?: () => void): void {
  if (poller && pollerTournamentId === tournamentId) return;
  stopTournamentCrowdPoller();

  pollerTournamentId = tournamentId;
  let scheduled = false;
  unsubscribe = subscribeCrowdActivity(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      syncFastPoll();
      onChange?.();
    });
  });
  poller = startCrowdPoller({ tournamentId });
}

/** Stop polling and empty the index, so the next tournament starts with no stale badges. */
export function stopTournamentCrowdPoller(): void {
  poller?.stop();
  unsubscribe?.();
  if (fastTimer) clearInterval(fastTimer);
  fastTimer = undefined;
  poller = undefined;
  unsubscribe = undefined;
  pollerTournamentId = undefined;
  setActiveCountsFromSnapshot([]);
}

/** Run one poll now (e.g. after the TD promotes or dismisses a session). */
export function refreshTournamentCrowdActivity(): Promise<number> {
  return poller?.runOnce() ?? Promise.resolve(0);
}
