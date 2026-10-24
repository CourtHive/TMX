import { formatLiveScore, hasOfficialScore, pickLiveScore } from 'services/messaging/liveScoreDisplay';
import { getActiveSessionCount, getTrustedCrowdScore } from 'services/crowd/crowdActivityIndex';
import { createCrowdBadge, createLiveTag } from 'components/elements/matchUpActivityBadges';
import { isMatchUpAwaitingReconciliation } from 'services/crowd/delegatedReconciliation';
import { getLiveTrackedScore } from 'services/messaging/liveTrackedScores';
import { MATCHUP_STATUS_DISPLAY } from './matchUpStatusDisplay';
import { t } from 'i18n';

export function scoreFormatter(cell: any): HTMLSpanElement | undefined {
  const data = cell.getRow().getData();
  const matchUpId = data.matchUp?.matchUpId;
  const statusLabel = MATCHUP_STATUS_DISPLAY[data.matchUp?.matchUpStatus];
  // A live score (tracker, or promoted crowd session) is shown only until an official one exists; it is the TD's
  // planning aid, not a result.
  const trustedCrowd = getTrustedCrowdScore(matchUpId);
  const live = pickLiveScore(getLiveTrackedScore(matchUpId), trustedCrowd);
  const liveScore = hasOfficialScore(data.matchUp) ? '' : formatLiveScore(live?.score);
  const crowdCount = matchUpId ? getActiveSessionCount(matchUpId) : 0;
  // `scorePermitted` is decided once per row when the table data is built (mapMatchUp / mapRound), not per render.
  if (!data.score && !statusLabel && !data.scorePermitted && !liveScore && !crowdCount) return undefined;

  const content = document.createElement('span');
  content.classList.add('scoreCell');
  if (data.score) {
    content.style.fontSize = 'smaller';
    content.textContent = data.score;
  } else if (liveScore) {
    content.style.fontSize = 'smaller';
    const score = document.createElement('span');
    score.className = 'tmx-live-score';
    score.textContent = liveScore;
    content.append(createLiveTag(), score);
  } else if (statusLabel) {
    content.textContent = statusLabel;
  } else if (data.scorePermitted) {
    content.style.color = 'var(--tmx-accent-blue)';
    content.style.fontSize = 'smaller';
    content.textContent = t('schedule.enterScore');
  }

  if (crowdCount) {
    content.prepend(
      createCrowdBadge({
        matchUpId,
        count: crowdCount,
        trusted: !!trustedCrowd,
        matchUpLabel: data.matchUp?.roundName,
      }),
    );
  }

  if (isMatchUpAwaitingReconciliation(matchUpId)) {
    const badge = document.createElement('span');
    badge.className = 'delegated-reconciliation-badge';
    badge.title = t('crowd.tooltip.unconfirmed');
    badge.setAttribute('aria-label', t('crowd.tooltip.unconfirmedAria'));
    badge.textContent = '⚠';
    badge.style.cssText =
      'color: var(--tmx-status-warning, #f59e0b); margin-right: 4px; font-size: 0.7rem; vertical-align: middle;';
    content.prepend(badge);
  }

  return content;
}
