import { isMatchUpCrowdsourced } from 'services/messaging/crowdsourcedScores';

export function scoreFormatter(cell: any): HTMLSpanElement | undefined {
  const data = cell.getRow().getData();
  if (!data.readyToScore) return;

  const isWalkover = data.matchUp.matchUpStatus === 'WALKOVER';

  const content = document.createElement('span');
  content.classList.add('scoreCell');
  if (data.score) {
    content.style.fontSize = 'smaller';
    content.innerHTML = data.score;
  } else if (isWalkover) {
    content.innerHTML = 'WO';
  } else {
    content.style.color = 'var(--tmx-accent-blue)';
    content.style.fontSize = 'smaller';
    content.innerHTML = 'Enter score';
  }

  if (isMatchUpCrowdsourced(data.matchUp?.matchUpId)) {
    const badge = document.createElement('span');
    badge.className = 'crowdsourced-score-badge';
    badge.title = 'Score reported via live tracker';
    badge.setAttribute('aria-label', 'Score reported via live tracker');
    badge.textContent = '●';
    badge.style.cssText =
      'color: var(--tmx-accent-green, #10b981); margin-right: 4px; font-size: 0.7rem; vertical-align: middle;';
    content.prepend(badge);
  }

  return content;
}
