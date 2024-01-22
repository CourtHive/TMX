import { deleteAdHocMatchUps } from 'components/modals/deleteAdHocMatchUps';
import { addAdHocMatchUps } from 'components/modals/addAdHocMatchUps';
import { addAdHocRound } from 'components/modals/addAdHocRound';
import { tournamentEngine } from 'tods-competition-factory';

import { RIGHT } from 'constants/tmxConstants';

export const deleteMatchUpsAction = 'Delete matches';
export const addMatchUpsAction = 'Add matches';
export const addRoundAction = 'Add round';

export function getAdHocRoundOptions({ structure, drawId, callback }) {
  if (!tournamentEngine.isAdHoc({ structure })) return {};
  const refreshCallback = () => callback({ refresh: true });

  const actionOptions = [
    {
      onClick: () => addAdHocMatchUps({ drawId, structure, callback: refreshCallback }),
      label: addMatchUpsAction,
      color: 'blue',
    },
    {
      onClick: () => addAdHocRound({ drawId, structure, newRound: true, callback: refreshCallback }),
      label: addRoundAction,
      color: 'blue',
    },
    {
      label: deleteMatchUpsAction,
      color: 'red',
      onClick: () => deleteAdHocMatchUps({ drawId, structure, callback: refreshCallback }),
    },
  ];
  return {
    label: 'Round actions', // also toggle between finishing positions and matches
    options: actionOptions,
    selection: false,
    location: RIGHT,
    align: RIGHT,
  };
}
