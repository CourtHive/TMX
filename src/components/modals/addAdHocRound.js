import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

import { ADD_ADHOC_MATCHUPS } from 'constants/mutationConstants';
import { AUTOMATED, MANUAL } from 'constants/tmxConstants';

export function addAdHocRound({ drawId, structure, structureId, callback } = {}) {
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
  const maxRoundNumber = Math.max(...roundNumbers, 1);
  if (matchUps.length) roundNumbers.push(maxRoundNumber + 1);

  let inputs;

  const addMatchUps = () => {
    console.log({ inputs }, inputs[AUTOMATED].value);

    const matchUps = [];

    if (inputs[AUTOMATED].value === AUTOMATED) {
      const result = tournamentEngine.drawMatic({ drawId, addToStructure: false });
      if (!result.matchUps?.length) return;
      matchUps.push(...result.matchUps);
    } else {
      const result = tournamentEngine.generateAdHocMatchUps({
        addToStructure: false,
        newRound: true,
        structureId,
        drawId
      });
      console.log({ result });

      if (!result.matchUps?.length) return;
      matchUps.push(...result.matchUps);
    }

    const methods = [
      {
        params: {
          matchUps,
          drawId
        },
        method: ADD_ADHOC_MATCHUPS
      }
    ];

    const postMutation = (result) => {
      if (result.success) {
        if (isFunction(callback)) callback();
      } else {
        console.log(result.error);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    { label: 'Add', intent: 'is-success', close: true, onClick: addMatchUps }
  ];

  const options = [
    {
      field: AUTOMATED,
      value: AUTOMATED,
      options: [
        { label: AUTOMATED, value: AUTOMATED, selected: true },
        { label: MANUAL, value: false }
      ]
    }
  ];

  const content = (elem) => (inputs = renderForm(elem, options));

  openModal({ title: 'Add round', content, buttons });
}
