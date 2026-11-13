/**
 * When this tab may replace its tournament record with the server's on its own (option B in
 * planning/TMX_CHECK_IN_INTENTS_AND_RECONNECT.md).
 *
 * The staleness probe, a reconnect, or an answer this copy could not apply all say the same thing: the server holds
 * a write this tab does not. Elsewhere the director pulls the record by clicking the stale indicator (option A). A
 * surface that knows its own draft state can opt in to having it pulled for it, and only while nothing would be
 * lost or overtaken by the install:
 *
 * - a surface has registered, and says it holds no draft: unknown surfaces never opt in;
 * - no command is waiting for a connection or an answer: the answer could apply a write newer than the snapshot;
 * - no score is being entered.
 *
 * DOM-free on purpose, like the rest of services/: the surface passes its own predicate, so neither the grid's
 * draft nor the workspace queue is imported here.
 */
import { isScoringActive } from 'services/transitions/activeScoringGuard';
import { unsettledCommandCount } from 'services/messaging/socketIo';

interface RecoverySurface {
  /** True while the surface holds anything an install would discard or overtake: a pending gesture, typed input. */
  isDirty: () => boolean;
}

let surface: RecoverySurface | undefined;

/** Opt the mounted surface in. Returns the function that opts it out, which leaves a later registration alone. */
export function registerRecoverySurface(isDirty: () => boolean): () => void {
  const registered: RecoverySurface = { isDirty };
  surface = registered;
  return () => {
    if (surface === registered) surface = undefined;
  };
}

/** Whether a surface on screen would recover automatically, were it clean. */
export function hasRecoverySurface(): boolean {
  return !!surface;
}

/** Checked before the fetch and again before the install: either may find a draft the other did not. */
export function canInstallAuthoritativeSnapshot(): boolean {
  if (!surface) return false;
  if (unsettledCommandCount() > 0) return false;
  if (isScoringActive()) return false;
  try {
    return !surface.isDirty();
  } catch {
    return false;
  }
}
