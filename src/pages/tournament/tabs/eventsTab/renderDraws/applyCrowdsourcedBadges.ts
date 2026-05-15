import { isMatchUpCrowdsourced } from 'services/messaging/crowdsourcedScores';

const BADGE_CLASS = 'crowdsourced-bracket-badge';

/**
 * Add a small persistent indicator to bracket matchUp cells whose matchUpId
 * has received a live relay score in the current tournament session.
 *
 * The bracket renderer (`renderMatchUp` in courthive-components) sets the
 * matchUpId as the container `id` and tags the element with `.tmx-m`, so a
 * single querySelectorAll pass after morphdom decorates everything.
 */
export function applyCrowdsourcedBadges(root: HTMLElement | null | undefined): void {
  if (!root) return;
  const cells = root.querySelectorAll<HTMLElement>('.tmx-m');
  for (const cell of cells) {
    if (cell.querySelector(`.${BADGE_CLASS}`)) continue;
    if (!isMatchUpCrowdsourced(cell.id)) continue;
    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.title = 'Score reported via live tracker';
    badge.setAttribute('aria-label', 'Score reported via live tracker');
    badge.textContent = '●';
    badge.style.cssText =
      'position: absolute; top: 2px; right: 4px; color: var(--tmx-accent-green, #10b981); font-size: 0.6rem; pointer-events: none; z-index: 1;';
    if (getComputedStyle(cell).position === 'static') cell.style.position = 'relative';
    cell.appendChild(badge);
  }
}
