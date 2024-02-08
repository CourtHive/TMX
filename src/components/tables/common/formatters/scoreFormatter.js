export function scoreFormatter(cell) {
  const data = cell.getRow().getData();
  if (!data.readyToScore) return;

  const isWalkover = data.matchUp.matchUpStatus === 'WALKOVER';

  const content = document.createElement('span');
  content.classList.add('scoreCell');
  if (data.score) {
    content.style = 'font-size: smaller';
    content.innerHTML = data.score;
  } else if (isWalkover) {
    content.innerHTML = 'WO';
  } else {
    content.style = 'color: blue; font-size: smaller';
    content.innerHTML = 'Enter score';
  }

  return content;
}
