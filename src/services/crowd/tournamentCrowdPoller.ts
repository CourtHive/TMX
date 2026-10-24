/**
 * One crowd-activity poll per open tournament.
 *
 * The poll used to start only when the matchUps table mounted, so the draw view
 * — where a TD actually watches matches — never had crowd data unless that tab
 * had been visited first. The tournament owns the poll now; every view reads
 * `crowdActivityIndex`, and `onChange` lets the active view re-render once per
 * poll tick that moved anything.
 */
import { setActiveCountsFromSnapshot, subscribeCrowdActivity } from './crowdActivityIndex';
import { startCrowdPoller, type CrowdPoller } from './crowdPoller';

let poller: CrowdPoller | undefined;
let pollerTournamentId: string | undefined;
let unsubscribe: (() => void) | undefined;

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
    if (!onChange || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      onChange();
    });
  });
  poller = startCrowdPoller({ tournamentId });
}

/** Stop polling and empty the index, so the next tournament starts with no stale badges. */
export function stopTournamentCrowdPoller(): void {
  poller?.stop();
  unsubscribe?.();
  poller = undefined;
  unsubscribe = undefined;
  pollerTournamentId = undefined;
  setActiveCountsFromSnapshot([]);
}

/** Run one poll now (e.g. after the TD promotes or dismisses a session). */
export function refreshTournamentCrowdActivity(): Promise<number> {
  return poller?.runOnce() ?? Promise.resolve(0);
}
