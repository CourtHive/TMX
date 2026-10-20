import { isMatchUpAwaitingReconciliation } from 'services/crowd/delegatedReconciliation';
import { scoreActionPermitted } from 'services/transitions/scoreActionPermitted';
import { isMatchUpCrowdsourced } from 'services/messaging/crowdsourcedScores';
import { t } from 'i18n';

const STATUS_DISPLAY: Record<string, string> = {
  RETIRED: 'RET',
  WALKOVER: 'WO',
  DEFAULTED: 'DEF',
  DOUBLE_WALKOVER: 'DWO',
  DOUBLE_DEFAULT: 'DDEF',
  CANCELLED: 'CAN',
  ABANDONED: 'ABN',
};

export function scoreFormatter(cell: any): HTMLSpanElement | undefined {
  const data = cell.getRow().getData();
  const statusLabel = STATUS_DISPLAY[data.matchUp?.matchUpStatus];
  if (!data.score && !statusLabel && (!data.readyToScore || !scoreActionPermitted(data.matchUp))) return undefined;

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
