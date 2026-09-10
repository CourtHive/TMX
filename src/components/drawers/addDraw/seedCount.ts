/**
 * Seed-count choices for the draw form.
 *
 * The seeding policy still supplies the default. An explicit choice is an override of the policy's
 * `seedsCountThresholds`, which is why submitting one also sends `enforcePolicyLimits: false` —
 * without it the factory clamps the request straight back down to the threshold.
 *
 * The choices offered are shaped by the STRUCTURE, not by the policy, because the policy is the
 * thing being overridden. Two shapes matter:
 *
 *  - Elimination-style structures seed in power-of-two blocks ([1], [2], [3-4], [5-8], …), so the
 *    offered counts are powers of two.
 *  - Round robin seeds one participant per group before it seeds a second, so its offered counts
 *    are multiples of the group count — routinely NOT a power of two. A 15-player draw in groups of
 *    three wants five seeds, and the factory grants it.
 */
import { drawDefinitionConstants } from 'tods-competition-factory';

import { DRAW_MATIC } from 'constants/tmxConstants';

const { AD_HOC, ADAPTIVE, LUCKY_DRAW, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF, SWISS } = drawDefinitionConstants;

export const AUTOMATIC_SEED_COUNT = '';

const POWER_OF_TWO_SEED_COUNTS = [2, 4, 8, 16, 32, 64, 128, 256];

/**
 * Draw types where a seed count is meaningless and the factory will discard it.
 *
 * AD_HOC, SWISS and DRAW_MATIC generate pairings per round rather than from a positioned bracket.
 * LUCKY_DRAW and ADAPTIVE are zeroed outright — `generateNewDrawDefinition` forces `seedsCount` to
 * 0 for anything `isLuckyBasedDraw()` matches, silently. Offering a control for any of these
 * promises the operator something generation will throw away without a word.
 *
 * Kept as a local set rather than reaching for the factory's `isLuckyBasedDraw`, which is not
 * exported through a governor.
 */
const UNSEEDABLE_DRAW_TYPES = new Set<string>([AD_HOC, ADAPTIVE, DRAW_MATIC, LUCKY_DRAW, SWISS]);

const ROUND_ROBIN_DRAW_TYPES = new Set<string>([ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF]);

export function isSeedableDrawType(drawType?: string): boolean {
  return !!drawType && !UNSEEDABLE_DRAW_TYPES.has(drawType);
}

type SeedCountChoicesArgs = {
  participantsCount: number;
  groupSize?: number | string;
  drawType?: string;
  drawSize: number;
};

/** Group count for a round robin, matching the factory's `deriveGroups`: ceil(drawSize / groupSize). */
function getGroupCount({ drawType, drawSize, groupSize }: SeedCountChoicesArgs): number | undefined {
  if (!drawType || !ROUND_ROBIN_DRAW_TYPES.has(drawType)) return undefined;
  const size = Number(groupSize);
  if (!Number.isInteger(size) || size < 2) return undefined;
  return Math.ceil(drawSize / size);
}

export function getSeedCountChoices(params: SeedCountChoicesArgs): number[] {
  const { drawSize, participantsCount, drawType } = params;
  if (drawType !== undefined && !isSeedableDrawType(drawType)) return [];
  if (!Number.isFinite(drawSize) || drawSize < 2 || !Number.isFinite(participantsCount)) return [0];

  // Two ceilings, both structural. Half the positions is the point past which seeds are guaranteed
  // to meet each other in the first round, which is the opposite of what seeding is for; the
  // factory itself permits up to `drawSize`, so this is the form being opinionated, not the engine.
  // And there is no seeding a participant who has not entered.
  const limit = Math.min(Math.floor(drawSize / 2), Math.max(0, Math.floor(participantsCount)));

  const groupCount = getGroupCount(params);
  const counts = groupCount
    ? Array.from({ length: Math.floor(limit / groupCount) }, (_, index) => (index + 1) * groupCount)
    : POWER_OF_TWO_SEED_COUNTS;

  return [0, ...counts.filter((count) => count <= limit)];
}

type ResolveSeedsCountArgs = SeedCountChoicesArgs & {
  automaticSeedsCount: number;
  requestedValue: unknown;
};

/**
 * Resolve the seed count to submit, and say whether it was an explicit operator choice.
 *
 * Out-of-range requests are CLAMPED, never refused. The option list is rendered from form state
 * that can move underneath it — entries get accepted, the draw size changes — and the factory's own
 * behavior for an over-large `seedsCount` is to clamp, not to error. Refusing here would drop a
 * submission on the floor over a stale `<select>` while keeping the operator's intent ("seed
 * deeply") perfectly recoverable.
 */
export function resolveSeedsCount(params: ResolveSeedsCountArgs): { seedsCount: number; isOverride: boolean } {
  const { requestedValue, automaticSeedsCount, ...choiceArgs } = params;
  const automatic = { seedsCount: automaticSeedsCount, isOverride: false };

  if (requestedValue === AUTOMATIC_SEED_COUNT || requestedValue == null) return automatic;

  const requested = typeof requestedValue === 'number' ? requestedValue : Number(requestedValue);
  if (!Number.isInteger(requested) || requested < 0) return automatic;

  const choices = getSeedCountChoices(choiceArgs);
  // An unseedable drawType offers nothing; a value left over from a previous drawType selection is
  // not an override of anything.
  if (!choices.length) return { seedsCount: 0, isOverride: false };

  const supported = choices.filter((choice) => choice <= requested);
  return { seedsCount: supported.length ? Math.max(...supported) : 0, isOverride: true };
}
