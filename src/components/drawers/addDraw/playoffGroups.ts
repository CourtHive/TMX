/**
 * Playoff groups for ROUND_ROBIN_WITH_PLAYOFF, built from the add-draw drawer's inputs.
 *
 * Pure: reads `inputs[field].value`/`.checked` and returns plain objects, so the decisions are
 * unit-testable without a DOM.
 */
import { drawDefinitionConstants, tools } from 'tods-competition-factory';

// constants
import {
  BEST_FINISHERS,
  PLAYOFF_DRAW_TYPE,
  PLAYOFF_GROUP_SIZE,
  POSITIONS,
  TOP_FINISHERS,
  TOTAL_ADVANCE,
} from 'constants/tmxConstants';

const {
  AD_HOC,
  COMPASS,
  CURTIS,
  FEED_IN_CHAMPIONSHIP,
  FIRST_MATCH_LOSER_CONSOLATION,
  FIRST_ROUND_LOSER_CONSOLATION,
  OLYMPIC,
  PAGE_PLAYOFF,
  PLAYOFF,
  ROUND_ROBIN,
  SINGLE_ELIMINATION,
} = drawDefinitionConstants;

/** The playoff draw type the drawer opens on — also the factory's own default for a playoff group. */
export const DEFAULT_PLAYOFF_DRAW_TYPE: string = SINGLE_ELIMINATION;

/** Every draw type `getDrawTypeOptions({ isPlayoff: true })` offers. */
export const PLAYOFF_DRAW_TYPES: ReadonlySet<string> = new Set([
  SINGLE_ELIMINATION,
  ROUND_ROBIN,
  AD_HOC,
  COMPASS,
  CURTIS,
  FEED_IN_CHAMPIONSHIP,
  FIRST_MATCH_LOSER_CONSOLATION,
  FIRST_ROUND_LOSER_CONSOLATION,
  OLYMPIC,
  PAGE_PLAYOFF,
  PLAYOFF,
]);

/**
 * The playoff draw type to send, or undefined to leave it to the factory default.
 *
 * A `<select>` whose selected option has no `value` attribute reports the option's TEXT as its
 * value, so a divider (`'──────────'`) or placeholder can arrive here looking like a draw type.
 * Only a known playoff draw type is ever passed through.
 */
export function resolvePlayoffDrawType(value: unknown): string | undefined {
  return typeof value === 'string' && PLAYOFF_DRAW_TYPES.has(value) ? value : undefined;
}

/** The `drawType`/`structureOptions` spread into every playoff group. */
export function getPlayoffDrawProps(inputs?: any): { drawType?: string; structureOptions?: { groupSize: number } } {
  const playoffDrawType = resolvePlayoffDrawType(inputs?.[PLAYOFF_DRAW_TYPE]?.value);
  const playoffGroupSize = inputs?.[PLAYOFF_GROUP_SIZE]?.value
    ? Number.parseInt(inputs[PLAYOFF_GROUP_SIZE].value)
    : undefined;

  const playoffDrawProps: { drawType?: string; structureOptions?: { groupSize: number } } = {};
  if (playoffDrawType) playoffDrawProps.drawType = playoffDrawType;
  if (playoffDrawType === ROUND_ROBIN && playoffGroupSize) {
    playoffDrawProps.structureOptions = { groupSize: playoffGroupSize };
  }
  return playoffDrawProps;
}

export function getPlayoffGroups(
  playoffType: string,
  advancePerGroup: number,
  groupRemaining: boolean,
  groupSize: number,
  inputs?: any,
): any[] {
  const playoffGroups: any[] = [];
  const playoffDrawProps = getPlayoffDrawProps(inputs);

  if (playoffType === TOP_FINISHERS) {
    const groups = [tools.generateRange(1, advancePerGroup + 1)];
    if (groupRemaining) {
      const group = tools.generateRange(advancePerGroup + 1, groupSize + 1);
      if (group.length) groups.push(group);
    }
    groups.forEach((finishingPositions, i) => {
      playoffGroups.push({
        structureName: `Playoff ${i + 1}`,
        finishingPositions,
        ...playoffDrawProps,
      });
    });
  } else if (playoffType === BEST_FINISHERS) {
    const totalAdvance = Number.parseInt(inputs[TOTAL_ADVANCE]?.value || 0);
    if (totalAdvance > 0) {
      playoffGroups.push({
        finishingPositions: [1],
        bestOf: totalAdvance,
        rankBy: 'GEMscore',
        structureName: 'Playoff 1',
        ...playoffDrawProps,
      });
      if (groupRemaining) {
        playoffGroups.push({
          remainder: true,
          structureName: 'Playoff 2',
          ...playoffDrawProps,
        });
      }
    }
  } else if (playoffType === POSITIONS) {
    tools.generateRange(1, groupSize + 1).forEach((c) => {
      playoffGroups.push({
        structureName: `Playoff ${c}`,
        finishingPositions: [c],
        ...playoffDrawProps,
      });
    });
  }

  return playoffGroups;
}

/**
 * Playoff groups for structures added to an existing round robin (the addRRplayoffs modal): one group per
 * checked finishing position. `drawType` is omitted, leaving the factory default, unless the select holds a
 * real playoff draw type.
 */
export function buildAddedPlayoffGroups({
  checkedRanges,
  structureName,
  drawTypeValue,
  groupSizeValue,
}: {
  checkedRanges: { finishingPosition: number; finishingPositionRange: string }[];
  structureName: string;
  drawTypeValue: unknown;
  groupSizeValue?: unknown;
}): any[] {
  const drawType = resolvePlayoffDrawType(drawTypeValue);
  const groupSize = drawType === ROUND_ROBIN ? Number.parseInt(String(groupSizeValue)) || undefined : undefined;

  return checkedRanges.map(({ finishingPosition, finishingPositionRange }) => ({
    finishingPositions: [finishingPosition],
    structureName: `${structureName} ${finishingPositionRange}`,
    ...(drawType && { drawType }),
    ...(groupSize && { structureOptions: { groupSize } }),
  }));
}
