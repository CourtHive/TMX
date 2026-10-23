import { focusAdjacentField, focusFieldWhenRendered, hotkeyFields, isHotkeyEntryMode } from './hotkeyScoreField';
import { keyValueConstants, scoreGovernor } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { keypadClearRefused, keypadOutcome } from './keypadOutcome';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import hotkeys from 'hotkeys-js';
import { t } from 'i18n';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

const { HOTKEYS, SIDE1KEYS, MODIFIERS } = keyValueConstants;
// The factory's list names several keys twice (tab, shift+tab, enter, the arrows), and hotkeys-js registers each
// occurrence, so one Tab ran the handler twice and skipped a field. Register each key once.
const KEYS = [...new Set(HOTKEYS.split(','))].join(',');

type FocusData = {
  cell: any;
  replaceTableData: () => void;
};

export function hotKeyScoring(): { setFocusData: (params: FocusData) => void } {
  let focusData: FocusData | undefined;
  let updatedMatchUp: any;
  // Whether a key has changed the score of the cell in focus since it took focus
  let typed = false;

  const setFocusData = (params: FocusData) => {
    updatedMatchUp = undefined;
    typed = false;
    focusData = params;
  };

  hotkeys(KEYS + ',esc', (event, handler) => {
    if (focusData) {
      const element = focusData.cell.getElement();
      const targetElement = element.classList?.contains('tabulator-cell') ? element.firstChild : element;
      event.preventDefault();

      const data = focusData.cell.getRow().getData();
      if (!updatedMatchUp) updatedMatchUp = data.matchUp;

      const shifted = hotkeys.shift;
      const value = shifted ? handler.key.split((handler as any).splitKey)[1] : handler.key;

      if (value === 'esc') {
        focusData.replaceTableData();
        focusData = undefined;
      }

      // Hotkey entry mode: Tab / Shift+Tab move between the entry fields
      if (value === 'tab') {
        if (isHotkeyEntryMode()) focusAdjacentField(targetElement, shifted ? -1 : 1);
        return;
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
          typed = true;
          targetElement.innerText = updatedScoreString || 'Enter score';
          targetElement.classList?.remove('is-placeholder');
        }
      }
    }

    if (focusData && handler.key === 'enter' && saveOrAdvance(focusData, typed ? updatedMatchUp : undefined)) {
      focusData = undefined;
    }
  });

  return { setFocusData };
}

/**
 * Enter on a score cell. With a typed score, save it and (in entry mode) focus the next field once the table has
 * re-rendered; returns true. With nothing typed there is nothing to save: in entry mode move to the next field;
 * returns false, so the cell that now has focus keeps the keypad.
 */
function saveOrAdvance(focusData: FocusData, typedMatchUp: any): boolean {
  const element = focusData.cell.getElement();
  const current = element.classList?.contains('tabulator-cell') ? element.firstChild : element;
  if (!typedMatchUp) {
    if (isHotkeyEntryMode()) focusAdjacentField(current, 1);
    return false;
  }
  // The field after this one, to focus once the table has re-rendered with the saved score
  const fields = hotkeyFields();
  const nextMatchUpId = fields[fields.indexOf(current) + 1]?.dataset.matchUpId;
  const { replaceTableData } = focusData;
  const outcome = keypadOutcome(typedMatchUp);
  // Backspace to empty, then Enter, clears the result. A clear the engine would refuse (a later match depends on it;
  // reachable on a double exit, which has no winner but propagates) is stopped here with the reason, as the score
  // dialogs do, rather than sent to come back "No valid actions".
  const matchUp = focusData.cell.getRow().getData().matchUp;
  if (keypadClearRefused({ matchUp, outcome })) {
    tmxToast({ message: t('toasts.clearRefused'), intent: 'is-warning', pauseOnHover: true });
    replaceTableData();
    return true;
  }
  submitScore({
    callback: () => {
      replaceTableData();
      if (isHotkeyEntryMode()) focusFieldWhenRendered(nextMatchUpId);
    },
    matchUpId: typedMatchUp.matchUpId,
    drawId: typedMatchUp.drawId,
    outcome,
  });
  return true;
}

function submitScore({
  outcome,
  callback,
  matchUpId,
  drawId,
}: {
  outcome: any;
  callback: (result: any) => void;
  matchUpId: string;
  drawId: string;
}): void {
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
  const mutationCallback = (result: any) => {
    // Surface a rejection (e.g. ERR_INCOMPATIBLE_MATCHUP_STATUS when downstream
    // matchUps are active) instead of silently swallowing it — the passed
    // callback only reacts to success, so without this the score just fails
    // to update with no explanation.
    if (result?.error) tmxToast({ message: result.error.message ?? t('common.error'), intent: 'is-danger' });
    if (isFunction(callback)) callback({ ...result, outcome });
  };
  mutationRequest({ methods, callback: mutationCallback });
}
