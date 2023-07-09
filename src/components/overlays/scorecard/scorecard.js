import { createCollectionTable } from 'components/tables/collectionTable/createCollectionTable';
import { closeOverlay, openOverlay, setOverlayContent } from '../overlay';
import { updateTieFormat } from '../editTieFormat.js/updateTieFormat';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { RESET_SCORECARD } from 'constants/mutationConstants';

const WIN_INDICATOR = 'has-text-success';
const TIE_SIDE_1 = 'tieSide1';
const TIE_SIDE_2 = 'tieSide2';

export function openScorecard({ title, drawId, matchUpId, onClose }) {
  const result = tournamentEngine.findMatchUp({ drawId, matchUpId });
  const matchUp = result.matchUp;

  if (!matchUp || result.error) return;

  if (!title || !Array.isArray(matchUp?.tieFormat?.collectionDefinitions)) return;
  const content = renderScorecard({ matchUp });

  // title is passed into footer for re-creating scorecard after mutations
  const footer = getFooter({ title, drawId, matchUpId, onClose });

  return openOverlay({ title, content, footer });
}

export function renderScorecard({ matchUp }) {
  const contentContaner = document.createElement('div');
  contentContaner.className = 'overlay-content-container';
  const overview = getOverview({ matchUp });
  contentContaner.appendChild(overview);

  if (!context.collectionTables) context.collectionTables = [];

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
    context.collectionTables.push(table);

    contentContaner.appendChild(collection);
  }

  return contentContaner;
}

export function setTieScore(result) {
  const set = result?.score?.sets?.[0];
  if (!set) return;

  const side1Score = document.getElementById(TIE_SIDE_1);
  const side2Score = document.getElementById(TIE_SIDE_2);
  side1Score.classList.remove(WIN_INDICATOR);
  side2Score.classList.remove(WIN_INDICATOR);
  side1Score.innerHTML = set.side1Score;
  side2Score.innerHTML = set.side2Score;

  if (result.winningSide === 1) side1Score.classList.add(WIN_INDICATOR);
  if (result.winningSide === 2) side2Score.classList.add(WIN_INDICATOR);
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

  const side1Score = getSideScore({ matchUp, sideNumber: 1, id: TIE_SIDE_1 });
  const side2Score = getSideScore({ matchUp, sideNumber: 2, id: TIE_SIDE_2 });
  const vs = document.createElement('div');
  vs.className = 'score-vs';
  vs.innerHTML = 'vs';

  scoreFlex.appendChild(side1Score);
  scoreFlex.appendChild(vs);
  scoreFlex.appendChild(side2Score);

  scoreBox.appendChild(scoreFlex);

  return scoreBox;
}

function getSideScore({ matchUp, sideNumber, id }) {
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
  sideScore.id = id;

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

function getFooter({ title, drawId, matchUpId, onClose }) {
  const edit = document.createElement('button');
  edit.className = 'button is-warning is-light';
  edit.onclick = () => {
    // NOTE: this will reset a tieFormat to the next inherited tieFormat matchUp => structure => drawDefinition
    /*
    tournamentEngine.resetTieFormat({
      matchUpId, // must be a TEAM matchUp
      drawId, // required
      uuids // optional - in client/server scenarios generated matchUps must have equivalent matchUpIds
    });
    */
    const callback = () => {
      openScorecard({ title, drawId, matchUpId });
    };
    updateTieFormat({ matchUpId, drawId, callback });
  };
  edit.innerHTML = 'Edit scorecard';

  /*
  const reset = document.createElement('button');
  reset.className = 'button is-warning is-light';
  reset.onclick = () => {
    // NOTE: this will reset a tieFormat to the next inherited tieFormat matchUp => structure => drawDefinition
    // tournamentEngine.resetTieFormat({
    //   matchUpId, // must be a TEAM matchUp
    //   drawId, // required
    //   uuids // optional - in client/server scenarios generated matchUps must have equivalent matchUpIds
    // });
    console.log('reset');
  };
  reset.innerHTML = 'Reset';
  */

  const clear = document.createElement('button');
  clear.className = 'button is-info is-light button-spacer';
  clear.innerHTML = 'Clear results';

  clear.onclick = () => {
    const methods = [
      {
        params: { drawId, matchUpId },
        method: RESET_SCORECARD
      }
    ];
    const postMutation = (result) => {
      if (result.success) {
        const matchUp = tournamentEngine.findMatchUp({ drawId, matchUpId })?.matchUp;
        const content = renderScorecard({ matchUp });
        setOverlayContent({ content });
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const close = document.createElement('button');
  close.className = 'button is-info button-spacer';
  close.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    while (context.collectionTables.length) {
      const table = context.collectionTables.pop();
      table.destroy();
    }
    closeOverlay();
    isFunction(onClose) && onClose();
  };
  close.innerHTML = 'Done';

  const footer = document.createElement('div');
  footer.className = 'overlay-footer-wrap';
  footer.appendChild(edit);
  footer.appendChild(clear);
  footer.appendChild(close);

  return footer;
}
