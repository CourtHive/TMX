/**
 * The numbers behind a refused generation: more entries than the draw has places for.
 *
 * The factory refuses explicit drawEntries that the draw cannot hold ("Insufficient drawPositions to accommodate
 * entries", ERR_INSUFFICIENT_DRAW_POSITIONS) — by design: an explicit list names this draw's entries, and dropping
 * some silently would be worse. The director was shown that engine sentence. This counts what it means: the entries
 * that take a place, the places left once qualifier slots are held back, and how many are over.
 */
import { entryStatusConstants } from 'tods-competition-factory';

const { STRUCTURE_SELECTED_STATUSES } = entryStatusConstants;

export type InsufficientPositions = { entries: number; places: number; over: number };

export function insufficientPositions(drawOptions: any): InsufficientPositions | undefined {
  const drawSize = drawOptions?.drawSize;
  const drawEntries = drawOptions?.drawEntries;
  if (!Number.isInteger(drawSize) || !Array.isArray(drawEntries)) return undefined;

  const entries = drawEntries.filter(
    ({ entryStage, entryStatus }: any) =>
      (!entryStage || entryStage === 'MAIN') && STRUCTURE_SELECTED_STATUSES.includes(entryStatus),
  ).length;
  const qualifierSlots = (drawOptions.qualifyingProfiles ?? [])
    .flatMap((profile: any) => profile?.structureProfiles ?? [])
    .reduce((total: number, profile: any) => total + (profile?.qualifyingPositions ?? 0), 0);
  const places = drawSize - qualifierSlots;
  const over = entries - places;
  return over > 0 ? { entries, places, over } : undefined;
}
