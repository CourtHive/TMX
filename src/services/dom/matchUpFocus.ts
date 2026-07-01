/**
 * Cross-render matchUp focus.
 *
 * Route-driven navigation drops any non-route context (a matchUpId is not part
 * of the draw URL), so "navigate to this matchUp and highlight it" needs a small
 * stash that survives the navigate → render round-trip. Set the pending focus
 * before navigating; `renderDrawView` consumes it once the target structure has
 * rendered to scroll-to + pulse-highlight the matchUp. Mirrors the
 * `highlightDrawPosition` pattern used for draw positions.
 */
import { DRAWS_VIEW } from 'constants/tmxConstants';

let pendingMatchUpId: string | undefined;

export function setPendingMatchUpFocus(matchUpId?: string): void {
  pendingMatchUpId = matchUpId || undefined;
}

export function peekPendingMatchUpFocus(): string | undefined {
  return pendingMatchUpId;
}

export function clearPendingMatchUpFocus(): void {
  pendingMatchUpId = undefined;
}

/**
 * Apply the pending focus (if any) to the just-rendered draw. Clears it once
 * the matchUp is found + highlighted; leaves it in place otherwise so a later
 * render (e.g. the correct structure/view) can still consume it.
 */
export function consumePendingMatchUpFocus(): void {
  if (pendingMatchUpId && highlightMatchUp(pendingMatchUpId)) clearPendingMatchUpFocus();
}

/**
 * Scroll the rendered matchUp into view and pulse it. Returns false when the
 * element isn't in the DOM yet (wrong structure/view rendered) so the caller
 * can leave the pending focus in place for a later render.
 */
export function highlightMatchUp(matchUpId: string): boolean {
  if (!matchUpId) return false;
  const container: ParentNode = document.getElementById(DRAWS_VIEW) ?? document;
  const el = (container.querySelector(`#${CSS.escape(matchUpId)}`) ??
    container.querySelector(`[data-matchup-id="${matchUpId}"]`)) as HTMLElement | null;
  if (!el) return false;

  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  el.classList.add('matchup-highlight');
  setTimeout(() => el.classList.remove('matchup-highlight'), 4000);
  return true;
}
