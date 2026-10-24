import { onTournamentContextChanged } from 'services/tournament/tournamentContextObservers';
import { onMutationApplied } from 'services/mutation/mutationObservers';

/**
 * One factory read shared by everything a single render pass builds.
 *
 * A page render is synchronous, and the panels it builds each ask the engine for what they show: the
 * publishing tab read its publish state, events and date range three times per render, the overview
 * read the same participants and matchUps from two places. Each read is correct alone; together they
 * are the same question asked again of a record that has not changed in between.
 *
 * `readOncePerPass(key, read)` answers the first ask and hands the same value to the rest of the pass.
 * The values drop at the next microtask, so nothing outlives the render that asked: a later render, a
 * timer tick (embargo countdowns turn on the clock, not on mutations) or a re-render after an awaited
 * call reads fresh. They also drop the moment a mutation is applied or the tournament changes, so a
 * handler that mutates and re-renders within one task cannot read across the write.
 *
 * Callers share the value, so they must only read it. Key by method and the params that change the
 * answer (`'getParticipants:withScaleValues'`), never by a call site.
 */

const passValues = new Map<string, unknown>();
let dropQueued = false;

/** Drop the pass now: for a cache reset that must read fresh within the same task. */
export function dropPassValues(): void {
  passValues.clear();
  dropQueued = false;
}

export function readOncePerPass<T>(key: string, read: () => T): T {
  if (passValues.has(key)) return passValues.get(key) as T;
  const value = read();
  passValues.set(key, value);
  if (!dropQueued) {
    dropQueued = true;
    queueMicrotask(dropPassValues);
  }
  return value;
}

onMutationApplied(dropPassValues);
onTournamentContextChanged(dropPassValues);
