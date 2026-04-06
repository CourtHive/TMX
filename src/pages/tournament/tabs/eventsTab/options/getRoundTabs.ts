import { tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';

// Constants
import {
  ROUNDS_BRACKET,
  ROUNDS_COLUMNS,
  ROUNDS_RATINGS,
  ROUNDS_STANDINGS,
  ROUNDS_STATS,
  ROUNDS_SWISS_CHART,
  ROUNDS_TABLE,
} from 'constants/tmxConstants';
const { CONTAINER, SWISS } = drawDefinitionConstants;

export function getRoundTabs({ callback, structure, existingView, drawId }: any) {
  const displayUpdate = (view) => existingView !== view && callback({ refresh: true, view });
  const isRoundRobin = structure?.structureType === CONTAINER;
  const isAdHoc = tournamentEngine.isAdHoc({ structure });
  const { drawDefinition } = drawId ? tournamentEngine.getEvent({ drawId }) : ({} as any);
  const isSwiss = drawDefinition?.drawType === SWISS;

  const actionOptions: Array<{
    active: boolean;
    onClick: () => any;
    label: string;
    close: boolean;
  }> = [];

  if (isRoundRobin)
    actionOptions.push({
      active: !existingView || existingView === ROUNDS_BRACKET,
      onClick: () => displayUpdate(ROUNDS_BRACKET),
      label: 'Grid',
      close: true,
    });

  actionOptions.push({
    active: isRoundRobin ? existingView === ROUNDS_COLUMNS : !existingView || existingView === ROUNDS_COLUMNS,
    onClick: () => displayUpdate(ROUNDS_COLUMNS),
    label: isAdHoc ? 'Columns' : 'Cards',
    close: true,
  });

  if (isSwiss)
    actionOptions.push({
      active: existingView === ROUNDS_SWISS_CHART,
      onClick: () => displayUpdate(ROUNDS_SWISS_CHART),
      label: 'Chart',
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

  if (isSwiss)
    actionOptions.push({
      active: existingView === ROUNDS_STANDINGS,
      onClick: () => displayUpdate(ROUNDS_STANDINGS),
      label: 'Standings',
      close: true,
    });

  if (isAdHoc && !isSwiss)
    actionOptions.push({
      active: existingView === ROUNDS_RATINGS,
      onClick: () => displayUpdate(ROUNDS_RATINGS),
      label: 'Ratings',
      close: true,
    });

  return {
    tabs: actionOptions,
  };
}
