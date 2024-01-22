import { deleteAdHocMatchUps } from 'components/modals/deleteAdHocMatchUps';
import { addAdHocMatchUps } from 'components/modals/addAdHocMatchUps';
import { addAdHocRound } from 'components/modals/addAdHocRound';
import { tournamentEngine } from 'tods-competition-factory';

export const deleteMatchUpsAction = 'Delete matches';
export const addMatchUpsAction = 'Add matches';
export const addRoundAction = 'Add round';

export function getFinalColumn({ structure, drawId, callback }) {
  if (!tournamentEngine.isAdHoc({ structure })) return;

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
