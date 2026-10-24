import { createCrowdBadge, createLiveTag } from 'components/elements/matchUpActivityBadges';
import { getActiveSessionCount } from 'services/crowd/crowdActivityIndex';

const CONTAINER_CLASS = 'tmx-activity-badges';

/**
 * Decorate bracket matchUp cells with what is happening on them right now:
 * a LIVE tag when the cell is showing a tracker's live score (the renderer was
 * given a `liveTracked` display copy — see `overlayLiveScores`), and a crowd
 * badge with the number of active crowd-scoring sessions.
 *
 * The bracket renderer (`renderMatchUp` in courthive-components) sets the
 * matchUpId as the container `id` and tags the element with `.tmx-m`, so a
 * single querySelectorAll pass after morphdom decorates everything. Badges are
 * rebuilt on every pass because the crowd count changes between polls; morphdom
 * drops them on the next patch anyway, as they are not in its template.
 *
 * Placement: inline at the start of the scheduling row's action group, so the
 * badges sit beside the ⋮ instead of on top of it. A cell with no scheduling row
 * gets them floated top-right.
 */
export function applyMatchUpActivityBadges(
  root: HTMLElement | null | undefined,
  liveTrackedIds: Set<string> = new Set(),
): void {
  if (!root) return;
  for (const stale of root.querySelectorAll(`.${CONTAINER_CLASS}`)) stale.remove();

  const cells = root.querySelectorAll<HTMLElement>('.tmx-m');
  for (const cell of cells) {
    const matchUpId = cell.id;
    if (!matchUpId) continue;
    const isLive = liveTrackedIds.has(matchUpId);
    const crowdCount = getActiveSessionCount(matchUpId);
    if (!isLive && !crowdCount) continue;

    const container = document.createElement('span');
    container.className = CONTAINER_CLASS;
    if (crowdCount) container.appendChild(createCrowdBadge({ matchUpId, count: crowdCount }));
    if (isLive) container.appendChild(createLiveTag());

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
