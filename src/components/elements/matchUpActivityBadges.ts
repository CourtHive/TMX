/**
 * The two "something is happening on this match" signals, built once and used by
 * both the matchUps table's score cell and the bracket:
 *
 * - LIVE — a tracker (epixodic, IONSport) is streaming this match's score over the
 *   relay. Unofficial: the score shown beside it is what the tracker reported.
 * - Crowd (👥 N) — N active crowd-scoring sessions on this match. Clicking opens
 *   the crowd trackers dialog, where the TD promotes or accepts one. Once one is
 *   promoted the badge turns green with a ✓ and its score is shown as LIVE.
 */
import { openCrowdTrackersModal } from 'components/modals/crowdTrackersModal';
import { t } from 'i18n';

/** LIVE ahead of a live score — in a table's score cell and on a schedule grid cell's score line. */
export function createLiveTag(): HTMLSpanElement {
  const tag = document.createElement('span');
  tag.className = 'tmx-live-tag';
  tag.textContent = t('crowd.live');
  const tooltip = t('crowd.tooltip.liveScore');
  tag.title = tooltip;
  tag.setAttribute('aria-label', tooltip);
  return tag;
}

export function createCrowdBadge({
  matchUpId,
  count,
  trusted,
  matchUpLabel,
}: {
  matchUpId: string;
  count: number;
  trusted?: boolean;
  matchUpLabel?: string;
}): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = trusted ? 'tmx-crowd-badge tmx-crowd-badge--trusted' : 'tmx-crowd-badge';
  const label = t(trusted ? 'crowd.tooltip.crowdTrusted' : 'crowd.tooltip.crowdSessions', { count });
  badge.title = label;
  badge.setAttribute('aria-label', label);
  badge.setAttribute('role', 'button');
  badge.tabIndex = 0;

  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-users';
  badge.appendChild(icon);
  badge.appendChild(document.createTextNode(trusted ? `${count} ✓` : String(count)));

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
