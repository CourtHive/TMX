import { RIGHT, ROUNDS_COLUMNS, ROUNDS_STATS, ROUNDS_TABLE } from 'constants/tmxConstants';

export function getRoundDisplayOptions({ callback }) {
  const displayUpdate = (view) => callback({ refresh: true, view });

  const actionOptions = [
    {
      onClick: () => displayUpdate(ROUNDS_COLUMNS),
      label: 'Columns',
    },
    {
      onClick: () => displayUpdate(ROUNDS_TABLE),
      label: 'Table view',
    },
    {
      onClick: () => displayUpdate(ROUNDS_STATS),
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
