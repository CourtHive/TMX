const SELF_BG = '#e8e8e8';
const WON_COLOR = '#2E86C1';

const STATUS_DISPLAY: Record<string, string> = {
  WALKOVER: 'WO',
  DOUBLE_WALKOVER: 'DWO',
  DEFAULTED: 'DEF',
  DOUBLE_DEFAULT: 'DDEF',
  CANCELLED: 'CAN',
  ABANDONED: 'ABN',
};

export function bracketScoreFormatter(cell: any): string | HTMLElement {
  const value = cell.getValue();

  if (!value) return '';

  // Diagonal (self-match): gray background, empty content
  if (value.self) {
    cell.getElement().style.backgroundColor = SELF_BG;
    return '';
  }

  // BYE position: show "BYE" label
  if (value.bye) {
    const span = document.createElement('span');
    span.style.color = '#999';
    span.textContent = 'BYE';
    return span;
  }

  const el = cell.getElement();
  const matchUpStatus = value.matchUp?.matchUpStatus;
  const statusLabel = matchUpStatus && STATUS_DISPLAY[matchUpStatus];

  // Irregular ending without a score string — show the status
  if (statusLabel && !value.score) {
    el.style.cursor = 'pointer';
    const span = document.createElement('span');
    span.style.color = value.won ? WON_COLOR : '#999';
    span.textContent = statusLabel;
    return span;
  }

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

  // Show score, appending status label for partial irregular endings (e.g. "6-4 DEF")
  container.textContent = statusLabel ? `${value.score} ${statusLabel}` : value.score;

  return container;
}
