/**
 * Delete ad-hoc matchUps modal with selective filtering.
 * Removes matchUps based on completion status (empty, unscored, completed).
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

import { DELETE_ADHOC_MATCHUPS } from 'constants/mutationConstants';

type DeleteAdHocMatchUpsParams = {
  drawId?: string;
  roundNumber?: number;
  structure?: any;
  structureId?: string;
  callback?: (params: any) => void;
};

export function deleteAdHocMatchUps({ drawId, roundNumber, structure, structureId, callback }: DeleteAdHocMatchUpsParams = {}): void {
  structureId = structureId || structure?.structureId;

  const matchUps =
    tournamentEngine.allDrawMatchUps({
      matchUpFilters: { structureIds: [structureId] },
      drawId,
    }).matchUps || [];
  const roundNumbers = matchUps.reduce((roundNumbers: number[], matchUp: any) => {
    const roundNumber = matchUp.roundNumber;
    if (roundNumber && !roundNumbers.includes(roundNumber)) roundNumbers.push(roundNumber);
    return roundNumbers;
  }, []);

  roundNumber = roundNumber || (roundNumbers.length && roundNumbers[roundNumbers.length - 1]);
  if (!roundNumber) return;

  let inputs: any;

  const deleteRound = () => {
    const matchUpIds = matchUps
      .filter((matchUp: any) => {
        if (matchUp.roundNumber !== roundNumber) return;
        if (matchUp.winningSide && inputs.completed.checked) return true;
        if (matchUp.sides.some(({ participantId }: any) => participantId) && !matchUp.winningSide && inputs.unscored.checked)
          return true;
        return matchUp.sides.every(({ participantId }: any) => !participantId) && inputs.empties.checked;
      })
      .map(({ matchUpId }: any) => matchUpId);

    const methods = [
      {
        params: {
          removeCompleted: inputs.completed.checked,
          removeIncomplete: inputs.unscored.checked,
          removeUnassigned: inputs.empties.checked,
          structureId,
          matchUpIds,
          drawId,
        },
        method: DELETE_ADHOC_MATCHUPS,
      },
    ];

    const postMutation = (result: any) => {
      if (result.success) {
        if (isFunction(callback) && callback) callback({ refresh: true });
      } else {
        console.log({ postMutationError: result.error });
      }
    };

    if (matchUpIds.length) {
      mutationRequest({ methods, callback: postMutation });
    }
  };

  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    { label: 'Delete', intent: 'is-danger', close: true, onClick: deleteRound },
  ];

  const roundNumberOptions = roundNumbers.map((rn) => ({ label: rn, value: rn }));

  const roundNumberSelection = {
    text: 'Round number',
    fieldPair: {
      options: roundNumberOptions,
      field: 'roundNumber',
      value: roundNumber,
      id: 'roundNumber',
    },
  };
  const options = [
    roundNumberSelection,
    { spacer: true },
    {
      label: 'Remove empty (TBD) matches',
      intent: 'is-success',
      checkbox: true,
      field: 'empties',
      checked: true,
      id: 'empties',
    },
    {
      label: 'Remove incomplete/unscored matches',
      intent: 'is-danger',
      field: 'unscored',
      checkbox: true,
      id: 'unscored',
    },
    {
      label: 'Remove completed matches',
      intent: 'is-danger',
      field: 'completed',
      id: 'completed',
      checkbox: true,
      color: 'red',
    },
  ];

  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options));

  openModal({ title: 'Delete matches', content, buttons });
}
