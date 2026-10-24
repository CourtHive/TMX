/**
 * The two "something is happening on this match" signals, built once and used by
 * both the matchUps table's score cell and the bracket:
 *
 * - LIVE — a tracker (epixodic, IONSport) is streaming this match's score over the
 *   relay. Unofficial: the score shown beside it is what the tracker reported.
 * - Crowd (👥 N) — N active crowd-scoring sessions on this match. Clicking opens
 *   the crowd trackers dialog, where the TD promotes or accepts one.
 */
import { openCrowdTrackersModal } from 'components/modals/crowdTrackersModal';
import { t } from 'i18n';

export function createLiveTag(): HTMLSpanElement {
  const tag = document.createElement('span');
  tag.className = 'tmx-live-tag';
  tag.textContent = t('crowd.live');
  tag.title = t('crowd.tooltip.liveScore');
  tag.setAttribute('aria-label', t('crowd.tooltip.liveScore'));
  return tag;
}

export function createCrowdBadge({
  matchUpId,
  count,
  matchUpLabel,
}: {
  matchUpId: string;
  count: number;
  matchUpLabel?: string;
}): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = 'tmx-crowd-badge';
  const label = t('crowd.tooltip.crowdSessions', { count });
  badge.title = label;
  badge.setAttribute('aria-label', label);
  badge.setAttribute('role', 'button');
  badge.tabIndex = 0;

  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-users';
  badge.appendChild(icon);
  badge.appendChild(document.createTextNode(String(count)));

  const open = (event: Event) => {
    // The cell under the badge has its own click (scoring / matchUp actions).
    event.stopPropagation();
    event.preventDefault();
    openCrowdTrackersModal({ matchUpId, matchUpLabel });
  };
  badge.addEventListener('click', open);
  badge.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') open(event);
  });
  return badge;
}
