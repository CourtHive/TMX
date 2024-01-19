import { tournamentEngine } from 'tods-competition-factory';

import { RIGHT } from 'constants/tmxConstants';

export function getRoundDisplayOptions({ structure, drawId, callback }) {
  if (!tournamentEngine.isAdHoc({ structure })) return {};
  const refreshCallback = () => callback({ refresh: true });

  const displayUpdate = (view) => {
    console.log({ drawId, view });
    refreshCallback();
  };

  const actionOptions = [
    {
      onClick: () => displayUpdate('columns'),
      label: 'Columns',
    },
    {
      onClick: () => displayUpdate('table'),
      label: 'Table',
    },
    {
      onClick: () => displayUpdate('statistics'),
      label: 'Statistics',
    },
  ];

  return {
    label: 'Display', // also toggle between finishing positions and matches
    options: actionOptions,
    selection: false,
    location: RIGHT,
    align: RIGHT,
  };
}
