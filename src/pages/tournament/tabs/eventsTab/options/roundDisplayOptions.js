import { tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';

import { RIGHT, ROUNDS_COLUMNS, ROUNDS_STATS, ROUNDS_TABLE } from 'constants/tmxConstants';
const { CONTAINER } = drawDefinitionConstants;

export function getRoundDisplayOptions({ callback, structure, existingView }) {
  const displayUpdate = (view) => existingView !== view && callback({ refresh: true, view });
  const isRoundRobin = structure?.structureType === CONTAINER;
  const isAdHoc = tournamentEngine.isAdHoc({ structure });

  const actionOptions = [];

  existingView !== ROUNDS_COLUMNS &&
    actionOptions.push({
      onClick: () => displayUpdate(ROUNDS_COLUMNS),
      label: isAdHoc ? 'Columns' : 'Draw',
      close: true,
    });

  existingView !== ROUNDS_TABLE &&
    actionOptions.push({
      onClick: () => displayUpdate(ROUNDS_TABLE),
      label: 'Table view',
      close: true,
    });

  if ((isAdHoc || isRoundRobin) && existingView !== ROUNDS_STATS)
    actionOptions.push({
      onClick: () => displayUpdate(ROUNDS_STATS),
      label: 'Statistics',
      close: true,
    });

  return {
    label: 'Display', // also toggle between finishing positions and matches
    options: actionOptions,
    selection: false,
    location: RIGHT,
    align: RIGHT,
  };
}
