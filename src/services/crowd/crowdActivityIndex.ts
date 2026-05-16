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

const counts: Map<string, number> = new Map();
const listeners: Set<Listener> = new Set();

export function getActiveSessionCount(matchUpId: string): number {
  return counts.get(matchUpId) ?? 0;
}

export function hasActiveCrowdActivity(matchUpId: string): boolean {
  return getActiveSessionCount(matchUpId) > 0;
}

export function getAllMatchUpsWithActivity(): string[] {
  const ids: string[] = [];
  for (const [matchUpId, count] of counts) if (count > 0) ids.push(matchUpId);
  return ids;
}

/**
 * Replace the index with a new snapshot. Only matchUpIds whose count actually
 * changed (including drops to 0) get notified — listeners stay quiet during
 * a polling tick where nothing moved.
 */
export function setActiveCountsFromSnapshot(snapshot: { matchUpId: string }[]): void {
  const next: Map<string, number> = new Map();
  for (const row of snapshot) {
    next.set(row.matchUpId, (next.get(row.matchUpId) ?? 0) + 1);
  }

  // Emit drops (previous matchUpIds no longer in the snapshot).
  for (const [matchUpId, prevCount] of counts) {
    if (prevCount !== (next.get(matchUpId) ?? 0)) {
      // we'll emit below from the unified loop — record current state first
    }
  }

  // Diff and emit.
  const allIds = new Set<string>();
  for (const id of counts.keys()) allIds.add(id);
  for (const id of next.keys()) allIds.add(id);

  for (const id of allIds) {
    const prev = counts.get(id) ?? 0;
    const now = next.get(id) ?? 0;
    if (prev !== now) {
      if (now === 0) counts.delete(id);
      else counts.set(id, now);
      for (const fn of listeners) {
        try {
          fn(id, now);
        } catch (err) {
          console.warn('[crowdActivityIndex] listener threw', err);
        }
      }
    }
  }
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
  listeners.clear();
}
