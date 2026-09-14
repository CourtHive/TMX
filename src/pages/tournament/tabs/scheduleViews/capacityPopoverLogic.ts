/**
 * Pure helpers extracted from capacityPopover.ts so they can be unit-tested
 * without dragging tippy / courthive-components into the import graph (which
 * trips Vitest's node-env runner — TMX runs DOM-coupled tests in Playwright).
 *
 * Keep this file dependency-free.
 */

/**
 * Walks an existing `dateAvailability[]` array, updates (or inserts) the entry
 * for `next.date`, and leaves every other entry alone. Returns a new array; the
 * input is not mutated.
 *
 * This popover edits ONE thing — the open window for one date. It used to
 * REPLACE the date's entry with `{date, startTime, endTime}` plus whatever
 * `bookings` it found, which meant every other field on that entry was dropped
 * on the way past: `notes`, `extensions`, `timeItems`, and the record's own
 * `createdAt` / `updatedAt`. Nothing populates those today, so the loss was
 * latent rather than live — but an editor that discards what it does not
 * understand is a trap that springs the day something starts writing there,
 * and by then the cause is a long way from the symptom.
 *
 * Merging into the entry instead is both smaller and safer: spread what is
 * there, then overwrite the two times this popover owns.
 *
 * (Separately, the factory used to corrupt a DATE-LESS entry passed through
 * here into `date: "undefined"` — the string. That was a factory defect, fixed
 * in `#4866(factory)`, and is not something this function ever needed to guard.)
 */
export function updateCourtDateAvailability(
  existing: any,
  next: { date: string; startTime: string; endTime: string },
): any[] {
  const list: any[] = Array.isArray(existing) ? [...existing] : [];
  const idx = list.findIndex((entry) => entry?.date === next.date);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...next };
  } else {
    list.push({ ...next });
  }
  return list;
}
