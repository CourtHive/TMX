import { openScorecard } from 'components/overlays/scorecard/scorecard';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { participantConstants } from 'tods-competition-factory';
import { env } from 'settings/env';

const { TEAM } = participantConstants;

export const handleScoreClick = (replaceTableData, setFocusData) => (e, cell) => {
  const data = cell.getRow().getData();
  const { matchUpId, readyToScore, matchUpType, drawId, eventName } = data.matchUp;
  if (matchUpType === TEAM) {
    const onClose = () => replaceTableData();
    openScorecard({ title: eventName, matchUpId, drawId, onClose });
  } else if (readyToScore || data.matchUp.score?.scoreStringSide1)
    if (env.hotkeys && !env.device.isMobile) {
      setFocusData({ e, cell, replaceTableData });
      const tcells = document.querySelectorAll('.activeScoreCell');
      for (const tcell of Array.from(tcells)) {
        tcell.classList.remove('activeScoreCell');
      }
      if (e.target.classList.contains('tabulator-cell')) {
        e.target.firstChild.classList.add('activeScoreCell');
      } else {
        e.target.classList.add('activeScoreCell');
      }
    } else {
      enterMatchUpScore({ matchUp: data.matchUp, matchUpId, callback: replaceTableData });
    }
};
