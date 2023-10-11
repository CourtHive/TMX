import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { openModal } from './baseModal/baseModal';

import { DELETE_ADHOC_MATCHUPS } from 'constants/mutationConstants';

export function deleteAdHocMatchUps({ drawId, roundNumber, structure, structureId, callback } = {}) {
  structureId = structureId || structure?.structureId;

  const matchUps =
    tournamentEngine.allDrawMatchUps({
      matchUpFilters: { structureIds: [structureId] },
      drawId
    }).matchUps || [];
  const roundNumbers = matchUps.reduce((roundNumbers, matchUp) => {
    const roundNumber = matchUp.roundNumber;
    if (roundNumber && !roundNumbers.includes(roundNumber)) roundNumbers.push(roundNumber);
    return roundNumbers;
  }, []);

  roundNumber = roundNumber || (roundNumbers.length && roundNumbers[roundNumbers.length - 1]);
  if (!roundNumber) return;

  let inputs;

  const deleteRound = () => {
    const matchUpIds = matchUps
      .filter((matchUp) => {
        if (matchUp.roundNumber !== roundNumber) return;
        if (matchUp.winningSide && inputs.completed.checked) return true;
        if (matchUp.sides.some(({ participantId }) => participantId) && !matchUp.winningSide && inputs.unscored.checked)
          return true;
        return matchUp.sides.every(({ participantId }) => !participantId) && inputs.empties.checked;
      })
      .map(({ matchUpId }) => matchUpId);

    const methods = [
      {
        params: { drawId, structureId, matchUpIds },
        method: DELETE_ADHOC_MATCHUPS
      }
    ];

    if (matchUpIds.length) {
      mutationRequest({ methods, callback });
    }
  };

  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    { label: 'Delete', intent: 'is-danger', close: true, onClick: deleteRound }
  ];

  const roundNumberOptions = roundNumbers.map((rn) => ({ label: rn, value: rn }));

  const roundNumberSelection = {
    text: 'Round number',
    fieldPair: {
      options: roundNumberOptions,
      field: 'roundNumber',
      value: roundNumber,
      id: 'roundNumber'
    }
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
      id: 'empties'
    },
    {
      label: 'Remove incomplete/unscored matches',
      intent: 'is-danger',
      field: 'unscored',
      checkbox: true,
      id: 'unscored'
    },
    {
      label: 'Remove completed matches',
      intent: 'is-danger',
      field: 'completed',
      id: 'completed',
      checkbox: true,
      color: 'red'
    }
  ];

  const content = (elem) => (inputs = renderForm(elem, options));

  openModal({ title: 'Delete matches', content, buttons });
}
