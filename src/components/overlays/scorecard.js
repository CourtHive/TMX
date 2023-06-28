import { createCollectionTable } from 'components/tables/collectionTable/createCollectionTable';
import { closeOverlay, openOverlay } from './overlay';
import { context } from 'services/context';

export function openScorecard({ eventData, matchUp }) {
  const title = eventData?.eventInfo?.eventName;

  if (!title || !Array.isArray(matchUp?.tieFormat?.collectionDefinitions)) return;
  const content = renderScorecard({ matchUp });
  const footer = getFooter();

  return openOverlay({ title, content, footer });
}

export function renderScorecard({ matchUp }) {
  const contentContaner = document.createElement('div');
  contentContaner.className = 'overlay-content-container';
  const overview = getOverview({ matchUp });
  contentContaner.appendChild(overview);

  const collectionDefinitions = matchUp.tieFormat.collectionDefinitions;
  for (const collectionDefinition of collectionDefinitions) {
    const collectionMatchUps = matchUp.tieMatchUps.filter(
      (tieMatchUp) => tieMatchUp.collectionId === collectionDefinition.collectionId
    );
    const collection = document.createElement('div');
    collection.className = 'collection';
    const collectionName = document.createElement('div');
    collectionName.className = 'title is-4';
    collectionName.innerHTML = collectionDefinition.collectionName;
    collection.appendChild(collectionName);

    const tableElement = document.createElement('div');
    collection.appendChild(tableElement);

    const { table } = createCollectionTable({ matchUp, tableElement, collectionMatchUps });
    context.tables[collectionDefinition.collectionId] = table;

    contentContaner.appendChild(collection);
  }

  return contentContaner;
}

function getOverview({ matchUp }) {
  const overview = document.createElement('div');
  overview.className = 'overlay-content-overview';
  const overviewBody = document.createElement('div');
  overviewBody.className = 'overlay-content-body';

  const side1 = getSide({ matchUp, sideNumber: 1, justify: 'end' });
  const side2 = getSide({ matchUp, sideNumber: 2, justify: 'start' });
  const score = getScore({ matchUp });

  overviewBody.appendChild(side1);
  overviewBody.appendChild(score);
  overviewBody.appendChild(side2);

  overview.appendChild(overviewBody);

  return overview;
}

function getScore({ matchUp }) {
  const scoreBox = document.createElement('div');
  scoreBox.className = 'score-box';
  const scoreFlex = document.createElement('div');
  scoreFlex.className = 'score-flex';

  const side1Score = getSideScore({ matchUp, sideNumber: 1 });
  const side2Score = getSideScore({ matchUp, sideNumber: 2 });
  const vs = document.createElement('div');
  vs.className = 'score-vs';
  vs.innerHTML = 'vs';

  scoreFlex.appendChild(side1Score);
  scoreFlex.appendChild(vs);
  scoreFlex.appendChild(side2Score);

  scoreBox.appendChild(scoreFlex);

  return scoreBox;
}

function getSideScore({ matchUp, sideNumber }) {
  const sideString = `side${sideNumber}Score`;
  const score = matchUp.score?.sets?.[0]?.[sideString] || 0;

  const sideScore = document.createElement('span');
  sideScore.id = `sideScore${sideNumber}`;
  sideScore.className = 'side-score';
  if (sideNumber === 1) {
    sideScore.style.paddingLeft = '1rem';
  } else {
    sideScore.style.paddingRight = '1rem';
  }

  const winningSide = sideNumber === matchUp.winningSide;
  if (winningSide) sideScore.classList.add('has-text-success');

  sideScore.innerHTML = score;

  return sideScore;
}

function getSide({ matchUp, sideNumber, justify = 'start' }) {
  const side = document.createElement('div');
  side.className = `matchup-side justify-${justify}`;
  const sideName = document.createElement('div');
  sideName.className = 'side-name';
  sideName.innerHTML = matchUp.sides.find((side) => side.sideNumber === sideNumber)?.participant?.participantName;
  side.appendChild(sideName);
  return side;
}

function getFooter() {
  const reset = document.createElement('button');
  reset.className = 'button is-warning is-light';
  reset.onclick = () => console.log('reset');
  reset.innerHTML = 'Reset';

  const clear = document.createElement('button');
  clear.className = 'button is-info is-light button-spacer';
  clear.onclick = () => console.log('clear');
  clear.innerHTML = 'Clear';

  const close = document.createElement('button');
  close.className = 'button is-info button-spacer';
  close.onclick = closeOverlay;
  close.innerHTML = 'Done';

  const footer = document.createElement('div');
  footer.className = 'overlay-footer-wrap';
  footer.appendChild(reset);
  footer.appendChild(clear);
  footer.appendChild(close);

  return footer;
}
