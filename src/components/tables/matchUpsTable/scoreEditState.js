import { openScorecard } from 'components/overlays/scorecard/scorecard';
import { participantConstants } from 'tods-competition-factory';
import { getParent } from 'services/dom/parentAndChild';

const { TEAM } = participantConstants;

export const scoreEditState = (replaceTableData, setFocusData) => (e, cell) => {
  const data = cell.getRow().getData();
  const { matchUpId, readyToScore, matchUpType, drawId, eventName } = data.matchUp;
  if (matchUpType === TEAM) {
    const onClose = () => replaceTableData();
    openScorecard({ title: eventName, matchUpId, drawId, onClose });
  } else if (readyToScore || data.matchUp.score?.scoreStringSide1) {
    const gridCell = getParent(e.target, 'tabulator-cell');
    setFocusData({ e, cell, replaceTableData });
    console.log(gridCell.classList, matchUpId);
  }
};
