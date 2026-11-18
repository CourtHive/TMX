/**
 * A court's surface, read and written in CODES' fields.
 *
 * CODES has two: `surfaceCategory`, the class (CLAY, HARD, GRASS, CARPET, ARTIFICIAL — the factory's
 * `surfaceConstants`), and `surfaceType`, free text for the product or finish. TMX's Edit court wrote the class
 * into `surfaceType` and its courts table read it from there, so a court surfaced in CODES (the facilities
 * registry, an import, the court cards) showed no surface, and one surfaced by TMX showed none on its card.
 */
import { factoryConstants } from 'tods-competition-factory';

const SURFACE_CATEGORIES = new Set<string>(Object.values(factoryConstants.surfaceConstants) as string[]);

export const isSurfaceCategory = (value: unknown): value is string =>
  typeof value === 'string' && SURFACE_CATEGORIES.has(value);

/** The court's surface class: `surfaceCategory`, or a class an earlier TMX left in `surfaceType`. */
export function courtSurfaceCategory(court: any): string | undefined {
  if (isSurfaceCategory(court?.surfaceCategory)) return court.surfaceCategory;
  return isSurfaceCategory(court?.surfaceType) ? court.surfaceType : undefined;
}

/**
 * The `modifyCourt` modifications for a surface chosen in Edit court (`''` when cleared). A class an earlier TMX
 * left in `surfaceType` moves out of it; free text there is the operator's and stays.
 */
export function surfaceModifications(selected: string | undefined, court: any): Record<string, any> {
  const modifications: Record<string, any> = { surfaceCategory: isSurfaceCategory(selected) ? selected : undefined };
  if (isSurfaceCategory(court?.surfaceType)) modifications.surfaceType = undefined;
  return modifications;
}
