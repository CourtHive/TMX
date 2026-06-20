/**
 * Central mutation-applied notification.
 *
 * Every successful local factory mutation flows through `mutationRequest`
 * (the single client mutation path). Page-level caches that memoize factory
 * reads — e.g. the schedule2 matchUp cache — must drop their entries the
 * instant the underlying tournament state changes, otherwise a read taken
 * after the mutation serves pre-mutation data.
 *
 * Rather than make every mutation call site remember to invalidate every
 * cache (the gap that let score entry from the scoring modal leave the
 * schedule grid stale), `mutationRequest` fires `notifyMutationApplied()`
 * once per applied mutation and interested caches subscribe via
 * `onMutationApplied`. New caches opt in here; no call site changes needed.
 */

type MutationObserver = () => void;

const observers = new Set<MutationObserver>();

/**
 * Register a callback invoked after every successful local mutation.
 * Returns an unsubscribe function. Idempotent observers (cache clears) are
 * the intended use — keep the callback cheap and side-effect-free beyond the
 * cache it owns.
 */
export function onMutationApplied(observer: MutationObserver): () => void {
  observers.add(observer);
  return () => observers.delete(observer);
}

/**
 * Fire every registered observer. Called by `mutationRequest` after a
 * successful local `executionQueue`. An observer that throws must not
 * prevent the others from running, so each is wrapped.
 */
export function notifyMutationApplied(): void {
  for (const observer of observers) {
    try {
      observer();
    } catch (err) {
      console.error('[mutationObservers] observer threw', err);
    }
  }
}
