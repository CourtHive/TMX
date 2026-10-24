/**
 * In-memory index of active crowd-scoring sessions per matchUp.
 *
 * The Phase 4 poller writes counts here; matchUp row formatters and the
 * three-dot menu read from here. Pub-sub keeps the row glow + menu label
 * reactive without forcing the table to re-fetch on every render.
 *
 * Scope: one tournament at a time — `setActive` replaces the whole snapshot,
 * which fans out only the matchUps whose count actually changed.
 */

type Listener = (matchUpId: string, activeCount: number) => void;

/** The score of a matchUp's promoted (trusted) crowd session — what the TD chose to follow live. */
export interface TrustedCrowdScore {
  sessionId: string;
  currentScore: any;
  updatedAt?: string;
}

export interface CrowdSnapshotRow {
  matchUpId: string;
  sessionId?: string;
  trusted?: boolean;
  currentScore?: any;
  updatedAt?: string;
}

const counts: Map<string, number> = new Map();
const trustedScores: Map<string, TrustedCrowdScore> = new Map();
const listeners: Set<Listener> = new Set();

export function getActiveSessionCount(matchUpId: string): number {
  return counts.get(matchUpId) ?? 0;
}

export function hasActiveCrowdActivity(matchUpId: string): boolean {
  return getActiveSessionCount(matchUpId) > 0;
}

/** The most recently updated promoted session's score for the matchUp, if one is promoted. */
export function getTrustedCrowdScore(matchUpId: string | undefined): TrustedCrowdScore | undefined {
  if (!matchUpId) return undefined;
  return trustedScores.get(matchUpId);
}

export function hasTrustedSessions(): boolean {
  return trustedScores.size > 0;
}

export function getAllMatchUpsWithActivity(): string[] {
  const ids: string[] = [];
  for (const [matchUpId, count] of counts) if (count > 0) ids.push(matchUpId);
  return ids;
}

/**
 * Replace the index with a new snapshot. Only matchUpIds whose count or promoted
 * score actually changed (including drops to 0) get notified — listeners stay
 * quiet during a polling tick where nothing moved.
 */
export function setActiveCountsFromSnapshot(snapshot: CrowdSnapshotRow[]): void {
  const next: Map<string, number> = new Map();
  const nextTrusted: Map<string, TrustedCrowdScore> = new Map();
  for (const row of snapshot) {
    next.set(row.matchUpId, (next.get(row.matchUpId) ?? 0) + 1);
    if (!row.trusted || !row.currentScore) continue;
    const held = nextTrusted.get(row.matchUpId);
    if (held && (held.updatedAt ?? '') >= (row.updatedAt ?? '')) continue;
    nextTrusted.set(row.matchUpId, {
      sessionId: row.sessionId ?? '',
      currentScore: row.currentScore,
      updatedAt: row.updatedAt,
    });
  }

  const allIds = new Set<string>([...counts.keys(), ...next.keys(), ...trustedScores.keys(), ...nextTrusted.keys()]);
  for (const id of allIds) {
    const prev = counts.get(id) ?? 0;
    const now = next.get(id) ?? 0;
    const trustedChanged = trustedSignature(trustedScores.get(id)) !== trustedSignature(nextTrusted.get(id));
    if (now === 0) counts.delete(id);
    else counts.set(id, now);
    const trusted = nextTrusted.get(id);
    if (trusted) trustedScores.set(id, trusted);
    else trustedScores.delete(id);
    if (prev === now && !trustedChanged) continue;
    for (const fn of listeners) {
      try {
        fn(id, now);
      } catch (err) {
        console.warn('[crowdActivityIndex] listener threw', err);
      }
    }
  }
}

function trustedSignature(score: TrustedCrowdScore | undefined): string {
  return score ? `${score.sessionId}|${JSON.stringify(score.currentScore)}` : '';
}

export function subscribeCrowdActivity(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Test-only: full reset of the module's state. */
export function __resetCrowdActivityIndex(): void {
  counts.clear();
  trustedScores.clear();
  listeners.clear();
}
