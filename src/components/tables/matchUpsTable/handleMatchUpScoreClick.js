import { openScorecard } from 'components/overlays/scorecard/scorecard';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { participantConstants } from 'tods-competition-factory';

const { TEAM } = participantConstants;

export const handleScoreClick = (replaceTableData) => (e, cell) => {
  const data = cell.getRow().getData();
  const { matchUpId, readyToScore, matchUpType, drawId, eventName } = data.matchUp;
  if (matchUpType === TEAM) {
    const onClose = () => replaceTableData();
    openScorecard({ title: eventName, matchUpId, drawId, onClose });
  } else if (readyToScore || data.matchUp.score?.scoreStringSide1)
    // TODO: replace scoreStringSide1 with tournamentEngine.checkScoreHasValue
    enterMatchUpScore({ matchUpId, callback: replaceTableData });
};
