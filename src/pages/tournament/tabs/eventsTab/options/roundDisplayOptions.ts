/**
 * Round display view options for draw structures.
 * Provides options to switch between columns/draw view, table view, and statistics.
 */
import { drawDefinitionConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

import { RIGHT, ROUNDS_COLUMNS, ROUNDS_STATS, ROUNDS_TABLE } from 'constants/tmxConstants';
import { t } from 'i18n';
const { CONTAINER } = drawDefinitionConstants;

type RoundDisplayOptionsParams = {
  callback: (params: any) => void;
  structure: any;
  existingView: string;
};

export function getRoundDisplayOptions({ callback, structure, existingView }: RoundDisplayOptionsParams): any {
  const displayUpdate = (view: string) => existingView !== view && callback({ refresh: true, view });
  const isRoundRobin = structure?.structureType === CONTAINER;
  const isAdHoc = tournamentEngine.isAdHoc({ structure });

  const actionOptions: any[] = [];

  existingView !== ROUNDS_COLUMNS &&
    actionOptions.push({
      onClick: () => displayUpdate(ROUNDS_COLUMNS),
      label: isAdHoc ? 'Columns' : 'Draw',
      close: true,
    });

  existingView !== ROUNDS_TABLE &&
    actionOptions.push({
      onClick: () => displayUpdate(ROUNDS_TABLE),
      label: t('ui.tableView'),
      close: true,
    });

  if ((isAdHoc || isRoundRobin) && existingView !== ROUNDS_STATS)
    actionOptions.push({
      onClick: () => displayUpdate(ROUNDS_STATS),
      label: t('stats'),
      close: true,
    });

  return {
    label: t('ui.display'),
    options: actionOptions,
    selection: false,
    location: RIGHT,
    align: RIGHT,
  };
}
