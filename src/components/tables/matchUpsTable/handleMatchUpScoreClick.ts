import { exitBeforeArrivalAction, recordExitBeforeArrival } from 'services/transitions/recordExitBeforeArrival';
import { openScorecard } from 'components/overlays/scorecard/scorecard';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { isPointsTotalFormat } from 'functions/isPointsTotalFormat';
import { participantConstants } from 'tods-competition-factory';
import { preferencesConfig } from 'config/preferencesConfig';
import { deviceConfig } from 'config/deviceConfig';
import { escapeHtml } from 'utilities/escapeHtml';

const { TEAM } = participantConstants;

export const handleScoreClick = (replaceTableData, setFocusData) => (e, cell) => {
  const data = cell.getRow().getData();
  const { matchUpId, readyToScore, matchUpType, drawId, eventName } = data.matchUp;
  // one participant here and the other not yet arrived: a walkover or default can be recorded now
  const exitAction = matchUpType !== TEAM && !readyToScore ? exitBeforeArrivalAction({ matchUpId, drawId }) : undefined;
  if (matchUpType === TEAM) {
    const onClose = () => replaceTableData();
    openScorecard({ title: escapeHtml(eventName), matchUpId, drawId, onClose });
  } else if (exitAction) {
    recordExitBeforeArrival({ action: exitAction, matchUp: data.matchUp, callback: replaceTableData });
  } else if (readyToScore || data.matchUp.score?.scoreStringSide1)
    // The hotkey keypad is the factory's tennis keyValueScore: one digit is the losing side's games. It cannot
    // enter a combined-point total (SET1-S:P32: typing 1 gives "-1"), so such a matchUp opens the score dialog.
    if (
      preferencesConfig.get().hotkeys &&
      !deviceConfig.get().isMobile &&
      !isPointsTotalFormat(data.matchUp.matchUpFormat)
    ) {
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
