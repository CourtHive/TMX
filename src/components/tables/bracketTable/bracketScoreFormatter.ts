const SELF_BG = '#e8e8e8';
const WON_COLOR = '#2E86C1';

export function bracketScoreFormatter(cell: any): string | HTMLElement {
  const value = cell.getValue();

  if (!value) return '';

  // Diagonal (self-match): gray background, empty content
  if (value.self) {
    cell.getElement().style.backgroundColor = SELF_BG;
    return '';
  }

  const el = cell.getElement();

  // Ready to score but no result yet — show [Score] placeholder
  if (!value.score && value.readyToScore) {
    el.style.cursor = 'pointer';
    const placeholder = document.createElement('span');
    placeholder.style.color = '#999';
    placeholder.textContent = '[Score]';
    return placeholder;
  }

  if (!value.score) return '';

  // Has a score — make clickable
  el.style.cursor = 'pointer';

  const container = document.createElement('span');

  if (value.won) {
    container.style.color = WON_COLOR;
  }

  container.textContent = value.score;

  return container;
}
