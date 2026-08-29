/**
 * Turn a scale value into a number, or `undefined` when there isn't one.
 *
 * TEMPORARY LOCAL COPY. The factory now owns this — `resolveScaleValueNumber`
 * is exported from `tods-competition-factory` as of the scale-normalization
 * fix — but TMX is pinned to 6.33.0 and CI installs the PUBLISHED package
 * (it strips the `link:` overrides), so importing it here would fail CI until
 * factory publishes. **Once the pin is bumped past that release, delete this
 * file and import from the factory instead.**
 *
 * Three properties matter, and each corresponds to a defect this prevents:
 *
 * 1. **Values may be strings.** Real ingested records store `'12.48'`, not
 *    `12.48`. `mocksEngine` emits numbers, so a `typeof === 'number'` gate
 *    passes every test fixture and silently drops every real rating.
 * 2. **An empty string is not zero.** Records carry `''` for a participant with
 *    no rating on that scale. `Number('')` is `0`, and 0 on a scale declared
 *    `[1, 16]` is below the floor — a fabricated rating, not a missing one.
 * 3. **Zero is a legitimate rating.** PSA, SQUASH_LEVELS, ITTF and BWF all
 *    declare 0 inside their valid range, so truthiness tests (`value || 0`,
 *    `if (value)`) erase a real competitor.
 */

// constants and types
import { fixtures } from 'tods-competition-factory';

type ResolveParams = {
  accessor?: string;
  scaleName?: string;
};

function primitiveToNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function accessorsFor({ accessor, scaleName }: ResolveParams): string[] {
  // `accessor` and `accessors` are BOTH real fields on the factory's
  // ratingsParameters fixture — singular is the primary, plural is the full
  // list (UTR declares `accessor: 'utrRating'` and `accessors: ['utrRating']`).
  // attr-audit flags the pair as a possible typo; `accessors` is allow-listed in
  // attr-audit.allow.json rather than renamed, because renaming a real fixture
  // field on the tool's say-so is how a working attribute gets broken.
  const params = scaleName ? (fixtures as any)?.ratingsParameters?.[scaleName] : undefined;
  return [accessor, params?.accessor, ...(params?.accessors ?? [])].filter(
    (candidate: unknown): candidate is string => typeof candidate === 'string' && !!candidate,
  );
}

export function resolveScaleValueNumber(scaleValue: unknown, params: ResolveParams = {}): number | undefined {
  const primitive = primitiveToNumber(scaleValue);
  if (primitive !== undefined) return primitive;
  if (!scaleValue || typeof scaleValue !== 'object' || Array.isArray(scaleValue)) return undefined;

  const source = scaleValue as Record<string, unknown>;
  for (const accessor of accessorsFor(params)) {
    const resolved = primitiveToNumber(source[accessor]);
    if (resolved !== undefined) return resolved;
  }
  for (const value of Object.values(source)) {
    const resolved = primitiveToNumber(value);
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}

/** Whether a usable number is present. Use instead of truthiness so 0 counts. */
export function hasScaleValueNumber(scaleValue: unknown, params: ResolveParams = {}): boolean {
  return resolveScaleValueNumber(scaleValue, params) !== undefined;
}
