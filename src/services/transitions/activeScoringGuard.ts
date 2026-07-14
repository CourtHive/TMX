/**
 * Tracks the matchUp a director is currently entering a score for (one scoring
 * modal at a time) and whether a remote mutation has scored it out from under
 * them. Kept as a tiny standalone module — depends only on the engine, toast,
 * and i18n — so the remote-mutation handler can call `notifyRemoteScoringCollision`
 * WITHOUT importing the scoring modal (scoringV2) and its DOM-heavy deps, which
 * would drag `document` into node contexts (and form an import cycle via
 * mutationRequest → stalenessGuard → remoteMutations).
 */
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

let activeScoringMatchUpId: string | undefined;
let activeScoringChangedRemotely = false;
let onCollision: (() => void) | undefined;

/** Fresh score string for a matchUp straight from the engine. */
export function currentScoreString(matchUpId: string): string {
  const mu = tournamentEngine.q.matchUp({ matchUpId });
  return mu?.score?.scoreStringSide1 || t('common.noScore', { defaultValue: 'no score' });
}

/** Mark the modal-open matchUp. `onCollisionEffect` (e.g. a preview pulse) is
 *  injected so this module stays DOM-free. */
export function setActiveScoring(matchUpId: string, onCollisionEffect?: () => void): void {
  activeScoringMatchUpId = matchUpId;
  activeScoringChangedRemotely = false;
  onCollision = onCollisionEffect;
}

/** Clear on modal close (save / cancel / dismiss) so a later broadcast can't
 *  false-trigger against a stale matchUpId. */
export function clearActiveScoring(matchUpId: string): void {
  if (activeScoringMatchUpId !== matchUpId) return;
  activeScoringMatchUpId = undefined;
  activeScoringChangedRemotely = false;
  onCollision = undefined;
}

/** True when a remote mutation scored the open matchUp since the modal opened. */
export function activeScoringWasChangedRemotely(): boolean {
  return activeScoringChangedRemotely;
}

/** Clear the flag once the director has explicitly acknowledged the overwrite. */
export function acknowledgeRemoteScoringChange(): void {
  activeScoringChangedRemotely = false;
}

/**
 * Called by the remote-mutation handler with the matchUpIds a broadcast touched.
 * If the director is currently scoring one of them, flag it and warn (showing the
 * colleague's just-applied score) so their save can't silently clobber it.
 */
export function notifyRemoteScoringCollision(matchUpIds: string[]): void {
  if (!activeScoringMatchUpId || !matchUpIds?.includes(activeScoringMatchUpId)) return;
  if (activeScoringChangedRemotely) return; // already warned this session
  activeScoringChangedRemotely = true;
  onCollision?.();
  tmxToast({
    message: t('toasts.matchUpScoredElsewhere', {
      score: currentScoreString(activeScoringMatchUpId),
      defaultValue: `Another user just scored this match ({{score}}). Review before saving.`,
    }),
    intent: 'is-warning',
    pauseOnHover: true,
    duration: 10000,
  });
}
