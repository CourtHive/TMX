import { keyValueConstants, scoreGovernor } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { isFunction } from 'functions/typeOf';
import hotkeys from 'hotkeys-js';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

const { HOTKEYS, SIDE1KEYS, MODIFIERS } = keyValueConstants;

export function hotKeyScoring() {
  let focusData, updatedMatchUp;
  const setFocusData = (params) => {
    updatedMatchUp = undefined;
    focusData = params;
  };

  hotkeys(HOTKEYS + ',esc', (event, handler) => {
    if (focusData) {
      const element = focusData.cell.getElement();
      const targetElement = element.classList?.contains('tabulator-cell') ? element.firstChild : element;
      event.preventDefault();

      const data = focusData.cell.getRow().getData();
      if (!updatedMatchUp) updatedMatchUp = data.matchUp;

      const shifted = hotkeys.shift;
      const value = shifted ? handler.key.split(handler.splitKey)[1] : handler.key;

      if (value === 'esc') {
        focusData.replaceTableData();
        focusData = undefined;
      }

      if (value === 'tab') {
        /*
        const row = focusData.cell.getRow();
        let targetRow, targetData;
        let nextRow = row.getNextRow();
        while (nextRow && !targetRow) {
          const nextRowData = nextRow.getData();
          const canScore = nextRowData.readyToScore || nextRowData.score?.scoreStringSide1;
          if (canScore) {
            targetData = nextRowData;
            targetRow = nextRow;
          } else {
            nextRow = row.getNextRow();
          }
        }

        if (targetData) {
          const tcells = document.querySelectorAll('.activeScoreCell');
          for (const tcell of Array.from(tcells)) {
            tcell.classList.remove('activeScoreCell');
          }
          const targetCell = targetRow.getCell('scoreDetail');
          focusData.cell = targetCell;
          return; // critical
        }
        */
      }

      const lowSide = (SIDE1KEYS.some((k) => k === value) && (shifted ? 2 : 1)) || undefined;
      if (lowSide || MODIFIERS.includes(value)) {
        const { matchUpFormat, matchUpStatus, score, sets, winningSide } = updatedMatchUp;
        const {
          matchUpStatus: updatedMatchUpStatus,
          scoreString: updatedScoreString,
          winningSide: updatedWinningSide,
          sets: updatedSets,
          updated,
        } = scoreGovernor.keyValueScore({
          scoreString: score?.scoreStringSide1,
          shiftFirst: true,
          sets: sets || [],
          matchUpStatus,
          matchUpFormat,
          winningSide,
          lowSide,
          value,
        });

        if (updated) {
          updatedMatchUp = {
            matchUpId: data.matchUp.matchUpId,
            drawId: data.matchUp.drawId,
            score: { scoreStringSide1: updatedScoreString },
            matchUpStatus: updatedMatchUpStatus,
            winningSide: updatedWinningSide,
            sets: updatedSets,
            matchUpFormat,
            updated,
          };
          targetElement.innerText = updatedScoreString || 'Enter score';
        }
      }
    }

    if (focusData && handler.key === 'enter') {
      const scoreStringSide2 = scoreGovernor.generateScoreString({ sets: updatedMatchUp.sets, reversed: true });
      const scoreStringSide1 = scoreGovernor.generateScoreString({ sets: updatedMatchUp.sets });
      const outcome = {
        matchUpStatus: updatedMatchUp.matchUpStatus,
        winningSide: updatedMatchUp.winningSide,
        score: {
          sets: updatedMatchUp.sets,
          scoreStringSide1,
          scoreStringSide2,
        },
      };
      submitScore({
        callback: focusData.replaceTableData,
        matchUpId: updatedMatchUp.matchUpId,
        drawId: updatedMatchUp.drawId,
        outcome,
      });

      focusData = undefined;
    }
  });

  return { setFocusData };
}

function submitScore({ outcome, callback, matchUpId, drawId }) {
  const { matchUpStatus, winningSide, score } = outcome;
  const methods = [
    {
      method: SET_MATCHUP_STATUS,
      params: {
        outcome: {
          matchUpStatus,
          winningSide,
          score,
        },
        matchUpId,
        drawId,
      },
    },
  ];
  const mutationCallback = (result) => {
    isFunction(callback) && callback({ ...result, outcome });
  };
  mutationRequest({ methods, callback: mutationCallback });
}
