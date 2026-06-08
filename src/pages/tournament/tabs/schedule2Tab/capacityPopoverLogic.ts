/**
 * Pure helpers extracted from capacityPopover.ts so they can be unit-tested
 * without dragging tippy / courthive-components into the import graph (which
 * trips Vitest's node-env runner — TMX runs DOM-coupled tests in Playwright).
 *
 * Keep this file dependency-free.
 */

/**
 * Walks an existing `dateAvailability[]` array, replaces (or inserts) the
 * entry for `next.date`, and preserves any `bookings` already attached to
 * that date entry — the Row 3(b) popover edits only the open window;
 * block management belongs to the full painter. Returns a new array; the
 * input is not mutated.
 */
export function updateCourtDateAvailability(
  existing: any,
  next: { date: string; startTime: string; endTime: string },
): any[] {
  const list: any[] = Array.isArray(existing) ? [...existing] : [];
  const idx = list.findIndex((entry) => entry?.date === next.date);
  const merged = {
    ...next,
    ...(idx >= 0 && Array.isArray(list[idx]?.bookings) ? { bookings: list[idx].bookings } : {}),
  };
  if (idx >= 0) {
    list[idx] = merged;
  } else {
    list.push(merged);
  }
  return list;
}
