import { getActiveSessionCount, getTrustedCrowdScore } from 'services/crowd/crowdActivityIndex';
import { createCrowdBadge } from 'components/elements/matchUpActivityBadges';

const CONTAINER_CLASS = 'tmx-activity-badges';

/**
 * Decorate bracket matchUp cells with a crowd badge: the number of active
 * crowd-scoring sessions, green with a ✓ once one is promoted. (A live score
 * needs no badge here: the bracket is handed an IN_PROGRESS display copy — see
 * `overlayLiveScores` — and the renderer's own status pill already says LIVE.)
 *
 * The bracket renderer (`renderMatchUp` in courthive-components) sets the
 * matchUpId as the container `id` and tags the element with `.tmx-m`, so a
 * single querySelectorAll pass after morphdom decorates everything. Badges are
 * rebuilt on every pass because the crowd count changes between polls; morphdom
 * drops them on the next patch anyway, as they are not in its template.
 *
 * Placement: inline at the start of the scheduling row's action group, so the
 * badge sits beside the ⋮ instead of on top of it. A cell with no scheduling row
 * gets it floated top-right.
 */
export function applyMatchUpActivityBadges(root: HTMLElement | null | undefined): void {
  if (!root) return;
  for (const stale of root.querySelectorAll(`.${CONTAINER_CLASS}`)) stale.remove();

  const cells = root.querySelectorAll<HTMLElement>('.tmx-m');
  for (const cell of cells) {
    const matchUpId = cell.id;
    const crowdCount = matchUpId ? getActiveSessionCount(matchUpId) : 0;
    if (!crowdCount) continue;

    const container = document.createElement('span');
    container.className = CONTAINER_CLASS;
    container.appendChild(
      createCrowdBadge({ matchUpId, count: crowdCount, trusted: !!getTrustedCrowdScore(matchUpId) }),
    );

    const actionGroup = cell.querySelector<HTMLElement>('.chc-scheduling')?.lastElementChild as HTMLElement | null;
    if (actionGroup) {
      actionGroup.prepend(container);
    } else {
      container.classList.add(`${CONTAINER_CLASS}--floating`);
      if (getComputedStyle(cell).position === 'static') cell.style.position = 'relative';
      cell.appendChild(container);
    }
  }
}
