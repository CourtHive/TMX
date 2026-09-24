/**
 * Seed-count choices for the draw form.
 *
 * The seeding policy still supplies the default. A choice ABOVE what the policy permits is an
 * override of its `seedsCountThresholds`, which is why submitting one also sends
 * `enforcePolicyLimits: false` — without it the factory clamps the request straight back down.
 *
 * A choice the policy PERMITS is not an override, and this is the distinction the module turns on.
 * `SeedingPolicy.additionalSeeds` lets a governing body allow a bounded number of seeds above the
 * threshold — a protected ranking seeded alongside the normal seeds rather than in place of one of
 * them. Those counts are offered as their own group, and submitting one leaves `enforcePolicyLimits`
 * alone, because the policy is being honoured rather than set aside. Lifting the ceiling entirely
 * to grant a protection the policy already grants would be a strictly worse way to get the same
 * number.
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
import { t } from 'i18n';

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
  /** Seeds the policy permits ABOVE `thresholdSeedsCount`; from `getSeedsCount`. */
  additionalSeedsAllowed?: number;
  /** The count the policy's thresholds yield on their own; from `getSeedsCount`. */
  thresholdSeedsCount?: number;
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

/**
 * The counts a seeding policy's `additionalSeeds` allowance permits above its threshold.
 *
 * Returned separately from `getSeedCountChoices` rather than merged into it, because the two mean
 * different things to the operator and to `submitDrawParams`: one is the draw seeded more deeply,
 * the other is the same draw with a protection alongside. Merging them would produce a list of
 * bare numbers in which 8 and 9 look like neighbours.
 *
 * ROUND ROBIN IS EXCLUDED. Round robin seeds through `getSeedGroups`, which distributes by group
 * count rather than through the power-of-two seed blocks, and additional seeds are untested against
 * that path — it is named as not-covered in the factory's own documentation. Offering the control
 * where the engine's behaviour is unverified would be offering a guess.
 */
export function getAdditionalSeedCountChoices(params: SeedCountChoicesArgs): number[] {
  const { additionalSeedsAllowed = 0, thresholdSeedsCount = 0, drawSize, participantsCount, drawType } = params;

  if (additionalSeedsAllowed < 1 || thresholdSeedsCount < 1) return [];
  if (drawType !== undefined && !isSeedableDrawType(drawType)) return [];
  if (getGroupCount(params)) return [];
  if (!Number.isFinite(drawSize) || drawSize < 2 || !Number.isFinite(participantsCount)) return [];

  // The same structural ceilings the ordinary choices respect. An allowance is a permission, not a
  // guarantee that the draw has room for it or that enough people entered to fill it.
  const limit = Math.min(Math.floor(drawSize / 2), Math.max(0, Math.floor(participantsCount)));

  return Array.from({ length: additionalSeedsAllowed }, (_, index) => thresholdSeedsCount + index + 1).filter(
    (count) => count <= limit,
  );
}

/**
 * The `<select>` options for the seed-count field, built once and used by both the initial render
 * and every later rebuild.
 *
 * Both call sites previously mapped the choice list themselves. They had already drifted once over
 * what counts as an entry — the initial list disagreed with itself the moment anything on the form
 * was touched — and additional seeds would have given them a second thing to drift over.
 */
/**
 * The `<select>` options for the seed-count field, built once and used by both the initial render
 * and every later rebuild.
 *
 * Both call sites previously mapped the choice list themselves. They had already drifted once over
 * what counts as an entry — the initial list disagreed with itself the moment anything on the form
 * was touched — and additional seeds would have given them a second thing to drift over.
 */
export function buildSeedCountOptions(params: SeedCountChoicesArgs): { label: string; value: number | string }[] {
  const additional = new Set(getAdditionalSeedCountChoices(params));
  const thresholdSeedsCount = params.thresholdSeedsCount ?? 0;

  // Merged and sorted ASCENDING rather than appended as a second group. A 32-draw offers 0/2/4/8/16
  // structurally, so appending 9 and 10 would list them after 16 — a dropdown that counts upwards
  // and then jumps backwards, in which the two entries that need to be noticed read as a mistake.
  // A count reachable both ways keeps the additional label: it IS within the allowance, and that is
  // the more informative of the two things to say about it.
  const values = [...new Set([...getSeedCountChoices(params), ...additional])].sort((a, b) => a - b);

  return [
    { label: t('drawers.addDraw.automaticSeedsCount'), value: AUTOMATIC_SEED_COUNT },
    ...values.map((count) => ({
      // The suffix is the whole point of the distinction: a bare "9" beside "8" reads as one more
      // seed, when it is a seed the policy adds WITHOUT taking one away from anybody.
      label: additional.has(count)
        ? t('drawers.addDraw.additionalSeedsCount', { count: count - thresholdSeedsCount, seeds: count })
        : count
          ? String(count)
          : t('none'),
      value: count,
    })),
  ];
}

type ResolveSeedsCountArgs = SeedCountChoicesArgs & {
  automaticSeedsCount: number;
  requestedValue: unknown;
};

/**
 * Resolve the seed count to submit, and say whether it exceeds what the policy permits.
 *
 * `isOverride` means "above the policy's ceiling", NOT "the operator chose a number". Those were
 * the same thing until `additionalSeeds` existed; now a count inside the allowance is the policy
 * being honoured, and `submitDrawParams` must not disable policy limits to deliver it. The change
 * is also strictly safer for counts BELOW the threshold, which used to set
 * `enforcePolicyLimits: false` for no reason at all — nothing clamps a count the policy already
 * allows, so the flag was disabling a guard while achieving nothing.
 *
 * Out-of-range requests are CLAMPED, never refused. The option list is rendered from form state
 * that can move underneath it — entries get accepted, the draw size changes — and the factory's own
 * behavior for an over-large `seedsCount` is to clamp, not to error. Refusing here would drop a
 * submission on the floor over a stale `<select>` while keeping the operator's intent ("seed
 * deeply") perfectly recoverable.
 */
export function resolveSeedsCount(params: ResolveSeedsCountArgs): {
  seedsCount: number;
  isAdditional: boolean;
  isOverride: boolean;
} {
  const { requestedValue, automaticSeedsCount, ...choiceArgs } = params;
  const automatic = { seedsCount: automaticSeedsCount, isAdditional: false, isOverride: false };

  if (requestedValue === AUTOMATIC_SEED_COUNT || requestedValue == null) return automatic;

  const requested = typeof requestedValue === 'number' ? requestedValue : Number(requestedValue);
  if (!Number.isInteger(requested) || requested < 0) return automatic;

  const choices = [...getSeedCountChoices(choiceArgs), ...getAdditionalSeedCountChoices(choiceArgs)];
  // An unseedable drawType offers nothing; a value left over from a previous drawType selection is
  // not an override of anything.
  if (!choices.length) return { seedsCount: 0, isAdditional: false, isOverride: false };

  const supported = choices.filter((choice) => choice <= requested);
  const seedsCount = supported.length ? Math.max(...supported) : 0;

  const ceiling = (choiceArgs.thresholdSeedsCount ?? 0) + (choiceArgs.additionalSeedsAllowed ?? 0);
  const isAdditional = seedsCount > (choiceArgs.thresholdSeedsCount ?? 0) && seedsCount <= ceiling;

  return { seedsCount, isAdditional, isOverride: seedsCount > ceiling };
}
