import { deleteAdHocMatchUps } from 'components/modals/deleteAdHocMatchUps';
import { addAdHocMatchUps } from 'components/modals/addAdHocMatchUps';
import { addAdHocRound } from 'components/modals/addAdHocRound';
import { utilities } from 'tods-competition-factory';

import { RIGHT } from 'constants/tmxConstants';

export const deleteMatchUpsAction = 'Delete matches';
export const addMatchUpsAction = 'Add matches';
export const addRoundAction = 'Add round';

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
  addMatchUps.innerHTML = addMatchUpsAction;
  finalColumn.appendChild(addMatchUps);

  const addRound = document.createElement('button');
  addRound.className = 'button font-medium is-info is-outlined';
  addRound.onclick = () => {
    addAdHocRound({ drawId, structure, callback, newRound: true });
    addRound.blur();
  };
  addRound.style.marginBlockEnd = '.5em';
  addRound.style.width = '100%';
  addRound.innerHTML = addRoundAction;
  finalColumn.appendChild(addRound);

  const deleteRound = document.createElement('button');
  deleteRound.className = 'button font-medium is-danger is-outlined';
  deleteRound.onclick = () => {
    deleteAdHocMatchUps({ drawId, structure, callback });
    deleteRound.blur();
  };
  deleteRound.style.marginBlockEnd = '.5em';
  deleteRound.style.width = '100%';
  deleteRound.innerHTML = deleteMatchUpsAction;
  finalColumn.appendChild(deleteRound);

  return finalColumn;
}

export function getAdHocActions({ structure, drawId, callback }) {
  if (!utilities.isAdHoc({ structure })) return [];

  const actionOptions = [
    {
      onClick: () => addAdHocMatchUps({ drawId, structure, callback }),
      label: addMatchUpsAction,
      color: 'blue'
    },
    {
      onClick: () => addAdHocRound({ drawId, structure, newRound: true, callback }),
      label: addRoundAction,
      color: 'blue'
    },
    { label: deleteMatchUpsAction, color: 'red', onClick: () => deleteAdHocMatchUps({ drawId, structure, callback }) }
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
