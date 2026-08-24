/**
 * Schedule2 — compact check-in badge for catalog matchUp cards and strip cells.
 *
 * Answers *"is everyone for this match actually at the desk?"* at the moment the
 * operator is deciding which match to call next — while scanning the catalog,
 * before any card is selected and before the drag starts. The matchUp actions
 * popover carries the per-participant detail and the toggle; this is the
 * headline only.
 *
 * **Why a badge and not only a warn (D4d/D4f).** Of the three places a matchUp
 * is called to court, one — `runAutoCallPass` — is timer-driven and batched, so
 * there is nobody standing there to warn. D4f decides that autocall **calls and
 * marks** rather than skipping: a silent skip would stall the schedule for a
 * reason no operator can see. The badge is what "marks" means, so it has to be
 * a standing signal on the card rather than an interruption at call time.
 *
 * Rendered through `renderCardExtra` rather than by post-processing the card
 * DOM: the catalog rebuilds its cards on every state change, so an externally
 * appended node would be wiped rather than reused. Same contract as
 * `restBadge.ts` — return a freshly created element per call, or null.
 *
 * The pure model lives in `checkInBadgeModel` because TMX's unit suite runs in
 * the vitest `node` environment with no jsdom: a decision made inside the
 * element builder would get no coverage.
 */

import { getMatchUpCheckInState, checkInSummary } from 'services/checkIn/checkInState';
import { getCachedAllMatchUps } from './schedule2DataCache';
import { t } from 'i18n';

// constants and types
import type { MatchUpCheckInState } from 'services/checkIn/checkInState';

export type CheckInTone = 'none' | 'partial' | 'complete';

export interface CheckInBadgeModel {
  /** `1/2` — never a bare tick. The partial IS the state the desk manages. */
  text: string;
  tone: CheckInTone;
  count: number;
  total: number;
}

/**
 * What the badge should say, or null for "say nothing".
 *
 * **Silent when nobody has checked in.** A `0/2` on every uncalled match would
 * paint the whole catalog with a warning that carries no information — at the
 * start of a day nobody has checked in anywhere, so the signal would be pure
 * noise exactly when the operator most needs to scan. The badge earns its space
 * only once someone has actually presented at the desk, at which point the
 * difference between `1/2` and `2/2` is the decision.
 *
 * Also silent for a matchUp with no participants (an unfilled draw position):
 * there is nobody who *could* check in, so an absence is not a signal.
 */
export function checkInBadgeModel(state: MatchUpCheckInState): CheckInBadgeModel | null {
  if (!state.hasParticipants) return null;
  if (state.checkedInCount === 0) return null;

  return {
    text: checkInSummary(state),
    tone: state.allCheckedIn ? 'complete' : 'partial',
    count: state.checkedInCount,
    total: state.total,
  };
}

/** Resolve the hydrated matchUp — `checkedInParticipantIds` is attached by `addMatchUpContext`. */
function hydratedMatchUp(matchUpId: string): any {
  const matchUps = getCachedAllMatchUps()?.matchUps ?? [];
  return matchUps.find((matchUp: any) => matchUp?.matchUpId === matchUpId);
}

/**
 * The `renderCardExtra` implementation. Returns a fresh element per call, or
 * null when there is nothing worth saying.
 */
export function renderCheckInBadge(matchUpId: string): HTMLElement | null {
  if (!matchUpId) return null;

  const matchUp = hydratedMatchUp(matchUpId);
  if (!matchUp) return null;

  const model = checkInBadgeModel(getMatchUpCheckInState(matchUp));
  if (!model) return null;

  const badge = document.createElement('span');
  badge.className = `tmx-checkin-badge is-${model.tone}`;
  badge.dataset.checkInTone = model.tone;
  badge.dataset.checkInCount = String(model.count);
  badge.textContent = model.text;
  badge.title =
    model.tone === 'complete'
      ? t('checkIn.badgeComplete', { count: model.total })
      : t('checkIn.badgePartial', { count: model.total - model.count });
  return badge;
}
