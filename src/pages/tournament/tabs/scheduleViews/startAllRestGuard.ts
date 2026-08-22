/**
 * Schedule2 — recovery guard for the Now-row "Start all" bulk action.
 *
 * `startAll` takes every startable match on the strip to IN_PROGRESS in one
 * click. That is the one place a recovery violation is least likely to be
 * noticed: no card was selected, so the Inspector never rendered; no card was
 * dragged, so the catalog badge was never read; and the cost is multiplied by
 * however many courts are live.
 *
 * The guard annotates and confirms — it never blocks. A director overrides
 * recovery deliberately all the time (a retirement frees a court, a player
 * asks to go on early), and a bulk action that refuses to run is worse than one
 * that asks. What it must not do is start four matches silently when one of the
 * players walked off court twenty minutes ago.
 *
 * Pure: the caller supplies rest per matchUp, so this file has no engine, no
 * clock and no DOM.
 */

// constants and types
import type { RestResult, RestRow } from './participantRest';

export interface StartAllCandidate {
  matchUpId: string;
  courtName?: string;
}

/** One player who is not ready, and where they would be starting. */
export interface RestBlocker {
  matchUpId: string;
  courtName?: string;
  participantName: string;
  /** Absent when the player is still on court — there is no elapsed rest to report. */
  restMinutes?: number;
  requiredMinutes: number;
  onCourt: boolean;
}

export interface StartAllRestWarning {
  blockers: RestBlocker[];
  /** MatchUps with at least one blocker. Never larger than the candidate list. */
  affectedMatchUpIds: string[];
}

/** A row is a blocker when the player owes recovery or has not left the court. */
export function isBlocker(row: RestRow): boolean {
  return row.status === 'onCourt' || row.status === 'resting';
}

/**
 * Blockers across every match "Start all" would start. Returns undefined when
 * nothing is owed, so the caller can skip the confirm entirely rather than
 * showing an empty warning.
 */
export function collectStartAllRestWarning(
  candidates: StartAllCandidate[],
  restFor: (matchUpId: string) => RestResult,
): StartAllRestWarning | undefined {
  const blockers: RestBlocker[] = [];
  const affected = new Set<string>();

  for (const candidate of candidates) {
    const result = restFor(candidate.matchUpId);
    if (!result.evaluated) continue;
    for (const row of result.rows) {
      if (!isBlocker(row)) continue;
      affected.add(candidate.matchUpId);
      blockers.push({
        matchUpId: candidate.matchUpId,
        courtName: candidate.courtName,
        participantName: row.participantName,
        ...(row.restMinutes !== undefined && { restMinutes: row.restMinutes }),
        requiredMinutes: row.requiredMinutes,
        onCourt: row.status === 'onCourt',
      });
    }
  }

  if (!blockers.length) return undefined;
  return { blockers, affectedMatchUpIds: [...affected] };
}
