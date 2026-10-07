import { exitBeforeArrivalAction, recordExitBeforeArrival } from 'services/transitions/recordExitBeforeArrival';
import { participantConstants, scoreGovernor } from 'tods-competition-factory';
import { openScorecard } from 'components/overlays/scorecard/scorecard';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';

const { TEAM } = participantConstants;

export const handleScoreClick = (replaceTableData) => (_, cell) => {
  const row = cell.getRow();
  const data = row.getData();
  const { matchUpId, readyToScore, matchUpType, drawId, eventName } = data.matchUp;
  // one participant here and the other not yet arrived: a walkover or default can be recorded now
  const exitAction = matchUpType !== TEAM && !readyToScore ? exitBeforeArrivalAction({ matchUpId, drawId }) : undefined;
  if (matchUpType === TEAM) {
    const onClose = () => replaceTableData();
    openScorecard({ title: eventName, matchUpId, drawId, onClose });
  } else if (exitAction) {
    recordExitBeforeArrival({ action: exitAction, matchUp: data.matchUp, callback: () => replaceTableData() });
  } else if (readyToScore || scoreGovernor.checkScoreHasValue(data.matchUp)) {
    const callback = () => {
      replaceTableData();
    };
    enterMatchUpScore({ matchUp: data.matchUp, matchUpId, callback });
  }
};
