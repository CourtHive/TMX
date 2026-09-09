/**
 * Seed-count choices for the draw form.
 *
 * The factory policy still supplies the default. An explicit choice is capped
 * by both the structure capacity and the number of participants who will
 * actually occupy that stage, so the form cannot promise seed positions that
 * the generated structure cannot contain.
 */

export const AUTOMATIC_SEED_COUNT = '';

const SEED_COUNTS = [2, 4, 8, 16, 32, 64, 128];

export function getSeedCountChoices({
  drawSize,
  participantsCount,
}: {
  drawSize: number;
  participantsCount: number;
}): number[] {
  if (!Number.isFinite(drawSize) || drawSize < 2 || !Number.isFinite(participantsCount)) return [0];

  const normalizedDrawSize = 2 ** Math.ceil(Math.log2(drawSize));
  const structureLimit = normalizedDrawSize <= 4 ? Math.floor(normalizedDrawSize / 2) : normalizedDrawSize / 4;
  const limit = Math.min(structureLimit, Math.max(0, Math.floor(participantsCount)));

  return [0, ...SEED_COUNTS.filter((count) => count <= limit)];
}

export function resolveSeedsCount({
  requestedValue,
  automaticSeedsCount,
  drawSize,
  participantsCount,
}: {
  requestedValue: unknown;
  automaticSeedsCount: number;
  drawSize: number;
  participantsCount: number;
}): { seedsCount?: number; valid: boolean } {
  if (requestedValue === AUTOMATIC_SEED_COUNT || requestedValue == null) {
    return { seedsCount: automaticSeedsCount, valid: true };
  }

  const requested = typeof requestedValue === 'number' ? requestedValue : Number(requestedValue);
  const choices = getSeedCountChoices({ drawSize, participantsCount });
  if (!Number.isInteger(requested) || !choices.includes(requested)) return { valid: false };

  return { seedsCount: requested, valid: true };
}
