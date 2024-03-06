import { tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';

import { ROUNDS_COLUMNS, ROUNDS_STATS, ROUNDS_TABLE } from 'constants/tmxConstants';
const { CONTAINER } = drawDefinitionConstants;

export function getRoundTabs({ callback, structure, existingView }) {
  const displayUpdate = (view) => existingView !== view && callback({ refresh: true, view });
  const isRoundRobin = structure?.structureType === CONTAINER;
  const isAdHoc = tournamentEngine.isAdHoc({ structure });

  const actionOptions = [];

  actionOptions.push({
    active: !existingView || existingView === ROUNDS_COLUMNS,
    onClick: () => displayUpdate(ROUNDS_COLUMNS),
    label: isAdHoc ? 'Columns' : 'Draw',
    close: true,
  });

  actionOptions.push({
    active: existingView === ROUNDS_TABLE,
    onClick: () => displayUpdate(ROUNDS_TABLE),
    label: 'Table',
    close: true,
  });

  if (isAdHoc || isRoundRobin)
    actionOptions.push({
      active: existingView === ROUNDS_STATS,
      onClick: () => displayUpdate(ROUNDS_STATS),
      label: 'Stats',
      close: true,
    });

  return {
    tabs: actionOptions,
  };
}
