import { participantConstants, scoreGovernor } from 'tods-competition-factory';
import { openScorecard } from 'components/overlays/scorecard/scorecard';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';

const { TEAM } = participantConstants;

export const handleScoreClick = (replaceTableData) => (e, cell) => {
  const row = cell.getRow();
  const data = row.getData();
  const { matchUpId, readyToScore, matchUpType, drawId, eventName } = data.matchUp;
  if (matchUpType === TEAM) {
    const onClose = () => replaceTableData();
    openScorecard({ title: eventName, matchUpId, drawId, onClose });
  } else {
    if (readyToScore || scoreGovernor.checkScoreHasValue(data.matchUp)) {
      const callback = () => {
        replaceTableData();
      };
      enterMatchUpScore({ matchUpId, callback });
    }
  }
};
