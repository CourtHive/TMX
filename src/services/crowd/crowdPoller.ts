/**
 * Tournament-level crowd-activity poller — Phase 4.
 *
 * Calls score-relay's `GET /api/crowd-sessions?tournamentId=...&activeOnly=true`
 * every `intervalMs` (default 45s) and fans the result into
 * `crowdActivityIndex` so row formatters and the matchUp menu stay reactive.
 *
 * Errors are swallowed — the worst case is a stale glow, not a broken page.
 * Network errors are silenced via `{ silenceErrors: true }` so a flaky
 * score-relay doesn't toast every 45 seconds.
 */

import { isScoreRelayConfigured } from 'services/apis/scoreRelayApi';
import { setActiveCountsFromSnapshot } from './crowdActivityIndex';
import { getSessionsByTournamentId } from './scoreRelayClient';

export interface CrowdPollerOptions {
  tournamentId: string;
  intervalMs?: number;
  logger?: (message: string) => void;
  /** Injected for tests; defaults to global setInterval. */
  setTimer?: (handler: () => void, delay: number) => any;
  /** Injected for tests; defaults to global clearInterval. */
  clearTimer?: (handle: any) => void;
}

export interface CrowdPoller {
  /** Disposer — call to stop the poll. Safe to call multiple times. */
  stop: () => void;
  /** Run one poll immediately; resolves with the active session count. */
  runOnce: () => Promise<number>;
}

const FORTY_FIVE_SECONDS = 45_000;

export function startCrowdPoller(options: CrowdPollerOptions): CrowdPoller {
  const intervalMs = options.intervalMs ?? FORTY_FIVE_SECONDS;
  const log = options.logger ?? ((m: string) => console.log(`[crowdPoller] ${m}`));
  const setTimer = options.setTimer ?? setInterval;
  const clearTimer = options.clearTimer ?? clearInterval;

  async function runOnce(): Promise<number> {
    if (!isScoreRelayConfigured()) return 0;
    try {
      const sessions = await getSessionsByTournamentId({
        tournamentId: options.tournamentId,
        activeOnly: true,
        silenceErrors: true,
      });
      setActiveCountsFromSnapshot(sessions);
      return sessions.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`poll failed: ${message}`);
      return 0;
    }
  }

  // Fire-and-forget initial poll so the UI hydrates within the first tick.
  void runOnce();

  const handle = setTimer(() => {
    void runOnce();
  }, intervalMs);

  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearTimer(handle);
    },
    runOnce,
  };
}
