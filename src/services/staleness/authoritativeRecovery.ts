/**
 * When this tab may replace its tournament record with the server's (planning/TMX_CHECK_IN_INTENTS_AND_RECONNECT.md).
 *
 * The staleness probe, a reconnect, or an answer this copy could not apply all say the same thing: the server holds
 * a write this tab does not. The record is then installed in one of two ways, and both are refused while anything
 * would be lost or overtaken by the install:
 *
 * - no command is waiting for a connection or an answer: the answer could apply a write newer than the snapshot;
 * - no score is being entered;
 * - no registered draft is open: a surface's pending gesture or typed input, the scheduling tab's grid, queue or paint.
 *
 * Automatically (option B), only where the surface on screen opted in with `registerRecoverySurface`: unknown
 * surfaces never recover on their own. On request (option A, the stale indicator's click), anywhere: the operator
 * chose to load, but the same drafts are protected ("Manual refresh gets the same edit protection").
 *
 * A draft predicate is unknown territory when it throws; that counts as a draft. A refresh costs one more click, a
 * discarded entry costs the operator's work.
 *
 * DOM-free on purpose, like the rest of services/: surfaces pass their own predicates, so neither the grid's
 * draft nor the workspace queue is imported here.
 */
import { isScoringActive } from 'services/transitions/activeScoringGuard';
import { unsettledCommandCount } from 'services/messaging/socketIo';

type DraftPredicate = () => boolean;

interface RecoverySurface {
  /** True while the surface holds anything an install would discard or overtake: a pending gesture, typed input. */
  isDirty: DraftPredicate;
}

let surface: RecoverySurface | undefined;
const draftGuards = new Set<{ isDirty: DraftPredicate }>();

/**
 * Opt the mounted surface in to automatic recovery. Its predicate also protects its drafts from a manual refresh.
 * Returns the function that opts it out, which leaves a later registration alone.
 */
export function registerRecoverySurface(isDirty: DraftPredicate): () => void {
  const registered: RecoverySurface = { isDirty };
  surface = registered;
  return () => {
    if (surface === registered) surface = undefined;
  };
}

/** Protect a draft from any install without opting in to automatic recovery. Returns the function that releases it. */
export function registerDraftGuard(isDirty: DraftPredicate): () => void {
  const guard = { isDirty };
  draftGuards.add(guard);
  return () => {
    draftGuards.delete(guard);
  };
}

/** Whether a surface on screen would recover automatically, were it clean. */
export function hasRecoverySurface(): boolean {
  return !!surface;
}

function dirty(predicate: DraftPredicate): boolean {
  try {
    return !!predicate();
  } catch {
    return true;
  }
}

/** Whether an install now would discard or overtake anything: a command in flight, score entry, or a draft. */
function installWouldLoseWork(): boolean {
  if (unsettledCommandCount() > 0) return true;
  if (isScoringActive()) return true;
  if (surface && dirty(surface.isDirty)) return true;
  return [...draftGuards].some((guard) => dirty(guard.isDirty));
}

/** Automatic recovery. Checked before the fetch and again before the install: either may find a draft the other did not. */
export function canInstallAuthoritativeSnapshot(): boolean {
  return !!surface && !installWouldLoseWork();
}

/** A refresh the operator asked for. The same protections, without requiring an opted-in surface. Checked twice too. */
export function canRefreshOnRequest(): boolean {
  return !installWouldLoseWork();
}
