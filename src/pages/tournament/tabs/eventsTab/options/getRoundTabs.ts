import { defaultRoundsView, getRoundsViews } from './roundsViews';
import { tournamentEngine } from 'services/factory/engine';

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
import { t } from 'i18n';

export function getRoundTabs({ callback, structure, existingView, drawId }: any) {
  const displayUpdate = (view) => existingView !== view && callback({ refresh: true, view });
  const isAdHoc = tournamentEngine.isAdHoc({ structure });
  const { drawDefinition } = drawId ? tournamentEngine.getEvent({ drawId }) : ({} as any);
  const defaultView = defaultRoundsView(structure);

  const labels: Record<string, string> = {
    [ROUNDS_BRACKET]: t('ui.grid'),
    [ROUNDS_COLUMNS]: isAdHoc ? 'Columns' : 'Cards',
    [ROUNDS_SWISS_CHART]: t('ui.chart'),
    [ROUNDS_TABLE]: t('ui.table'),
    [ROUNDS_STATS]: t('ui.stats'),
    [ROUNDS_STANDINGS]: t('ui.standings'),
    [ROUNDS_RATINGS]: t('rtz'),
  };

  const tabs = getRoundsViews({ structure, drawType: drawDefinition?.drawType }).map((view) => ({
    active: existingView ? existingView === view : view === defaultView,
    onClick: () => displayUpdate(view),
    label: labels[view],
    close: true,
  }));

  return { tabs };
}
