import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { participantConstants } from 'tods-competition-factory';
import { openScorecard } from 'components/overlays/scorecard/scorecard';

const { TEAM } = participantConstants;

export const handleScoreClick = (replaceTableData) => (e, cell) => {
  const data = cell.getRow().getData();
  const { matchUpId, readyToScore, matchUpType, eventName } = data.matchUp;
  if (matchUpType === TEAM) {
    const onClose = () => replaceTableData();
    openScorecard({ title: eventName, matchUp: data.matchUp, onClose });
  } else {
    // TODO: replace scoreStringSide1 with tournamentEngine.checkScoreHasValue
    if (readyToScore || data.matchUp.score?.scoreStringSide1)
      enterMatchUpScore({ matchUpId, callback: replaceTableData });
  }
};
