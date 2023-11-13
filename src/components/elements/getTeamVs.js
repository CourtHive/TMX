export function getTeamVs({ side1, side2, side1Score, side2Score }) {
  const overview = document.createElement('div');
  overview.className = 'overlay-content-overview';
  const overviewBody = document.createElement('div');
  overviewBody.className = 'overlay-content-body';

  const score = buildScore({ side1Score, side2Score });

  overviewBody.appendChild(side1);
  overviewBody.appendChild(score);
  overviewBody.appendChild(side2);

  overview.appendChild(overviewBody);

  return overview;
}

export function getSide({ participantName, justify = 'start' }) {
  const side = document.createElement('div');
  side.className = `matchup-side justify-${justify}`;
  const sideName = document.createElement('div');
  sideName.className = 'side-name';
  sideName.innerHTML = participantName;
  side.appendChild(sideName);
  return side;
}

function buildScore({ side1Score, side2Score }) {
  const scoreBox = document.createElement('div');
  scoreBox.className = 'score-box';
  const scoreFlex = document.createElement('div');
  scoreFlex.className = 'score-flex';

  const vs = document.createElement('div');
  vs.className = 'score-vs';
  vs.innerHTML = 'vs';

  scoreFlex.appendChild(side1Score);
  scoreFlex.appendChild(vs);
  scoreFlex.appendChild(side2Score);

  scoreBox.appendChild(scoreFlex);

  return scoreBox;
}

export function getSideScore({ winningSide, sets, sideNumber, id }) {
  const sideString = `side${sideNumber}Score`;
  const score = sets?.[0]?.[sideString] || 0;

  const sideScore = document.createElement('span');
  if (id) sideScore.id = id;
  // sideScore.id = `sideScore${sideNumber}`;
  sideScore.className = 'side-score';
  if (sideNumber === 1) {
    sideScore.style.paddingLeft = '1rem';
  } else {
    sideScore.style.paddingRight = '1rem';
  }

  const isWinner = sideNumber === winningSide;
  if (isWinner) sideScore.classList.add('has-text-success');

  sideScore.innerHTML = score;

  return sideScore;
}
