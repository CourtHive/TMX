import { tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';

import { RIGHT, ROUNDS_COLUMNS, ROUNDS_STATS, ROUNDS_TABLE } from 'constants/tmxConstants';
const { CONTAINER } = drawDefinitionConstants;

export function getRoundDisplayOptions({ callback, structure }) {
  const displayUpdate = (view) => callback({ refresh: true, view });
  const isRoundRobin = structure?.structureType === CONTAINER;
  const isAdHoc = tournamentEngine.isAdHoc({ structure });

  const actionOptions = [];

  actionOptions.push({
    onClick: () => displayUpdate(ROUNDS_COLUMNS),
    label: isAdHoc ? 'Columns' : 'Draw',
  });

  actionOptions.push({
    onClick: () => displayUpdate(ROUNDS_TABLE),
    label: 'Table view',
  });

  if (isAdHoc || isRoundRobin)
    actionOptions.push({
      onClick: () => displayUpdate(ROUNDS_STATS),
      label: 'Statistics',
    });

  return {
    label: 'Display', // also toggle between finishing positions and matches
    options: actionOptions,
    selection: false,
    location: RIGHT,
    align: RIGHT,
  };
}
