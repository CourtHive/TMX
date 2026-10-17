/**
 * Which rounds views a structure offers, in menu order.
 *
 * The view menu (getRoundTabs) and the route (renderEventsTab) both read this, so a URL can only open a view the
 * menu would offer. A typed, bookmarked or stale `/view/roundsStats` on an elimination structure used to render the
 * stats table there, with no tab active. The factory tallies only round robin groups, ad hoc and lucky structures,
 * so on an elimination structure that table has nothing to show.
 */
import { drawDefinitionConstants, drawsGovernor } from 'tods-competition-factory';

// constants
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

type RoundsViewsParams = { structure?: any; drawType?: string };

export function getRoundsViews({ structure, drawType }: RoundsViewsParams): string[] {
  const isRoundRobin = structure?.structureType === CONTAINER;
  const isAdHoc = drawsGovernor.isAdHoc({ structure });
  const isSwiss = drawType === SWISS;

  const views: Array<string | false> = [
    isRoundRobin && ROUNDS_BRACKET,
    ROUNDS_COLUMNS,
    isSwiss && ROUNDS_SWISS_CHART,
    ROUNDS_TABLE,
    (isAdHoc || isRoundRobin) && ROUNDS_STATS,
    isSwiss && ROUNDS_STANDINGS,
    isAdHoc && !isSwiss && ROUNDS_RATINGS,
  ];
  return views.filter((view): view is string => !!view);
}

export function defaultRoundsView(structure?: any): string {
  return structure?.structureType === CONTAINER ? ROUNDS_BRACKET : ROUNDS_COLUMNS;
}

/** The requested view when the structure offers it, otherwise the structure's default view. */
export function resolveRoundsView({ roundsView, ...params }: RoundsViewsParams & { roundsView?: string }): string {
  if (roundsView && getRoundsViews(params).includes(roundsView)) return roundsView;
  return defaultRoundsView(params.structure);
}
