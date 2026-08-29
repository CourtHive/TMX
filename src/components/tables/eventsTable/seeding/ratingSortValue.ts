import { resolveScaleValueNumber } from 'functions/resolveScaleValueNumber';

/**
 * The sort key for seeding a field by a rating scale.
 *
 * Extracted from `generateSeedValues` so the decision can be tested. TMX has no
 * jsdom layer, so anything that stays inside a closure gets no unit coverage —
 * and this particular decision, made wrongly, seeds the wrong player #1.
 *
 * The previous implementation was `ratingObject?.[accessor] || 0`, which had two
 * failure modes that a numeric fixture cannot reach:
 *
 * - real records carry `''` for a participant with no rating on this scale, and
 *   `'' || 0` is `0`. On an ASCENDING scale (WTN, BWF — lower is better) that
 *   sorts FIRST, so an unrated participant was seeded #1.
 * - `|| 0` also collapses a legitimate `0`, which PSA, ITTF, BWF and
 *   SQUASH_LEVELS all declare inside their valid range.
 *
 * An unresolvable value now sinks to the end in whichever direction is being
 * sorted, rather than leading in one of them.
 */
export function ratingSortValue({
  rawValue,
  accessor,
  scaleName,
  reversed,
}: {
  rawValue: unknown;
  accessor?: string;
  scaleName?: string;
  /** True for ascending scales, where a LOWER value is stronger. */
  reversed?: boolean;
}): number {
  const resolved = resolveScaleValueNumber(rawValue, { accessor, scaleName });
  if (resolved !== undefined) return resolved;
  return reversed ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
}
