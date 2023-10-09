import { tournamentEngine, utilities } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { isFunction } from 'functions/typeOf';

import { BOTTOM, RIGHT } from 'constants/tmxConstants';
import { ADD_ADHOC_MATCHUPS } from 'constants/mutationConstants';

export function handleRoundHeaderClick(props) {
  const roundActions = [
    {
      onClick: () => addAdHocMatchUps({ ...props?.context, ...props }),
      text: 'Add match',
      color: 'blue'
    },
    {
      onClick: () => addAdHocMatchUps({ ...props?.context, ...props, roundNumber: undefined, newRound: true }),
      text: 'Add round',
      color: 'blue'
    },
    {
      onClick: () => console.log('delete matchUp(s)', { props }),
      text: 'Delete matches',
      color: 'red'
    },
    {
      onClick: () => console.log('delete round', { props }),
      text: 'Delete round',
      color: 'red'
    }
  ];
  if (props?.pointerEvent) {
    tipster({ items: roundActions, target: props.pointerEvent.target, config: { placement: BOTTOM } });
  }
}

export function getFinalColumn({ structure, drawId, callback }) {
  if (!utilities.isAdHoc({ structure })) return;

  const finalColumn = document.createElement('div');
  finalColumn.style =
    'display: flex; flex-direction: column; place-content: flex-start; height: 100%; margin-top: 2em;';

  const addMatchUps = document.createElement('button');
  addMatchUps.className = 'button font-medium is-info is-outlined';
  addMatchUps.onclick = () => {
    addAdHocMatchUps({ drawId, structure, callback });
    addMatchUps.blur();
  };
  addMatchUps.style.marginBlockEnd = '.5em';
  addMatchUps.style.width = '100%';
  addMatchUps.innerHTML = 'Add match';
  finalColumn.appendChild(addMatchUps);

  const addRound = document.createElement('button');
  addRound.className = 'button font-medium is-info is-outlined';
  addRound.onclick = () => {
    console.log('add round', { drawId, structure });
    addRound.blur();
  };
  addRound.style.marginBlockEnd = '.5em';
  addRound.style.width = '100%';
  addRound.innerHTML = 'Add round';
  finalColumn.appendChild(addRound);

  const deleteRound = document.createElement('button');
  deleteRound.className = 'button font-medium is-danger is-outlined';
  deleteRound.onclick = () => {
    console.log('delete round', { drawId, structure });
    deleteRound.blur();
  };
  deleteRound.style.marginBlockEnd = '.5em';
  deleteRound.style.width = '100%';
  deleteRound.innerHTML = 'Delete round';
  finalColumn.appendChild(deleteRound);

  return finalColumn;
}

export function getAdHocActions({ structure, drawId, callback }) {
  if (!utilities.isAdHoc({ structure })) return [];

  const actionOptions = [
    {
      onClick: () => addAdHocMatchUps({ drawId, structure, callback }),
      label: 'Add match',
      color: 'blue'
    },
    { label: 'Add round', color: 'blue', onClick: () => console.log('add round', { drawId, structure }) },
    { label: 'Delete round', color: 'red', onClick: () => console.log('delete round', { drawId, structure }) }
  ];
  const adHocActions = {
    label: 'Round actions', // also toggle between finishing positions and matches
    options: actionOptions,
    selection: false,
    location: RIGHT,
    align: RIGHT
  };
  return [adHocActions];
}

export function addAdHocMatchUps({ drawId, structure, structureId, roundNumber, callback, newRound } = {}) {
  structureId = structureId || structure?.structureId;
  if (!drawId) return;

  const result = tournamentEngine.generateAdHocMatchUps({
    addToStructure: false,
    matchUpsCount: 1,
    roundNumber,
    structureId,
    newRound,
    drawId
  });

  const methods = [
    {
      method: ADD_ADHOC_MATCHUPS,
      params: {
        matchUps: result.matchUps,
        drawId
      }
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
  /*
    result = tournamentEngine.addAdHocMatchUps({
      drawId: drawDefinition.drawId,
      matchUps: result.matchUps
    });
    */
  console.log({ result });
}
