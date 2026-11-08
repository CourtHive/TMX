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
 *
 * An auth refusal (401/403) that survives scoreRelayApi's refresh is not a blip: the next tick would get the same
 * answer. The interval keeps ticking but skips polls on a doubling backoff (capped at 10 minutes), logging once when a
 * refusal streak starts and once when it ends — not on every tick, which flooded the console (2026-11-08).
 */

import { isCrowdScoringEnabled } from 'services/apis/scoreRelayApi';
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
  /** Injected for tests; defaults to Date.now. */
  now?: () => number;
}

export const MAX_AUTH_BACKOFF_MS = 10 * 60_000;

const authStatusOf = (err: unknown): number | undefined => {
  const status = (err as any)?.response?.status;
  return status === 401 || status === 403 ? status : undefined;
};

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

  const now = options.now ?? Date.now;
  let authFailures = 0;
  let resumeAt = 0;

  async function runOnce(): Promise<number> {
    if (!isCrowdScoringEnabled()) return 0;
    try {
      const sessions = await getSessionsByTournamentId({
        tournamentId: options.tournamentId,
        activeOnly: true,
        silenceErrors: true,
      });
      if (authFailures) log(`relay accepted the session again after ${authFailures} refused poll(s)`);
      authFailures = 0;
      resumeAt = 0;
      setActiveCountsFromSnapshot(sessions);
      return sessions.length;
    } catch (err) {
      const status = authStatusOf(err);
      if (status) {
        authFailures += 1;
        const delay = Math.min(intervalMs * 2 ** (authFailures - 1), MAX_AUTH_BACKOFF_MS);
        resumeAt = now() + delay;
        if (authFailures === 1) log(`relay refused the session (${status}); backing off, retrying in ${delay / 1000}s`);
        return 0;
      }
      const message = err instanceof Error ? err.message : String(err);
      log(`poll failed: ${message}`);
      return 0;
    }
  }

  // Fire-and-forget initial poll so the UI hydrates within the first tick.
  void runOnce();

  // The interval keeps its cadence; a tick inside an auth backoff is skipped. An explicit runOnce() (a view asking
  // for fresh counts) still polls, so a recovered session shows at once.
  const handle = setTimer(() => {
    if (now() < resumeAt) return;
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
