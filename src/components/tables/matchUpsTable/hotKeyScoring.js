import { keyValueConstants, scoreGovernor } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { isFunction } from 'functions/typeOf';
import hotkeys from 'hotkeys-js';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

const { HOTKEYS, SIDE1KEYS, MODIFIERS } = keyValueConstants;

export function hotKeyScoring() {
  let focusData, updatedMatchUp;
  const setFocusData = (params) => {
    focusData = params;
    updatedMatchUp = undefined;
  };

  hotkeys(HOTKEYS, (event, handler) => {
    if (focusData) {
      const data = focusData.cell.getRow().getData();
      if (!updatedMatchUp) updatedMatchUp = data.matchUp;
      const shifted = hotkeys.shift;
      const value = shifted ? handler.key.split(handler.splitKey)[1] : handler.key;
      event.preventDefault();
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
          updatedMatchUp = Object.assign({}, data.matchUp, {
            score: { scoreStringSide1: updatedScoreString },
            matchUpStatus: updatedMatchUpStatus,
            winningSide: updatedWinningSide,
            sets: updatedSets,
            matchUpFormat,
            updated,
          });
          console.log(updatedScoreString);
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
      console.log('submit score', { outcome });
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
