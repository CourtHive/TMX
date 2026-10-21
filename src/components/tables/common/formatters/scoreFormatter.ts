import { isMatchUpAwaitingReconciliation } from 'services/crowd/delegatedReconciliation';
import { isMatchUpCrowdsourced } from 'services/messaging/crowdsourcedScores';
import { MATCHUP_STATUS_DISPLAY } from './matchUpStatusDisplay';
import { t } from 'i18n';

export function scoreFormatter(cell: any): HTMLSpanElement | undefined {
  const data = cell.getRow().getData();
  const statusLabel = MATCHUP_STATUS_DISPLAY[data.matchUp?.matchUpStatus];
  // `scorePermitted` is decided once per row when the table data is built (mapMatchUp / mapRound), not per render.
  if (!data.score && !statusLabel && !data.scorePermitted) return undefined;

  const content = document.createElement('span');
  content.classList.add('scoreCell');
  if (data.score) {
    content.style.fontSize = 'smaller';
    content.textContent = data.score;
  } else if (statusLabel) {
    content.textContent = statusLabel;
  } else {
    content.style.color = 'var(--tmx-accent-blue)';
    content.style.fontSize = 'smaller';
    content.textContent = t('schedule.enterScore');
  }

  if (isMatchUpCrowdsourced(data.matchUp?.matchUpId)) {
    const badge = document.createElement('span');
    badge.className = 'crowdsourced-score-badge';
    badge.title = t('crowd.tooltip.liveTracker');
    badge.setAttribute('aria-label', t('crowd.tooltip.liveTracker'));
    badge.textContent = '●';
    badge.style.cssText =
      'color: var(--tmx-accent-green, #10b981); margin-right: 4px; font-size: 0.7rem; vertical-align: middle;';
    content.prepend(badge);
  }

  if (isMatchUpAwaitingReconciliation(data.matchUp?.matchUpId)) {
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
