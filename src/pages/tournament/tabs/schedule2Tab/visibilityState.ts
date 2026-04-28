/**
 * Cross-view court visibility state for the Schedule2 tab.
 *
 * gridView mutates the set via its eye-icon popover; profileView reads it
 * to scope Apply Grid / Apply Schedule to the visible courts; clear actions
 * use it to scope which matchUps to clear.
 *
 * Visibility is reset whenever the active date changes — each day is its own
 * scheduling pass.
 */

// Mutations happen in gridView (eye-icon popover); within this file the Set
// is only read/cleared, which sonarjs flags as a never-populated collection
// — the warning is silenced at each in-file usage site below since the
// add/delete callers live in another module.
export const hiddenCourtIds = new Set<string>();

let trackedDate = '';

export function syncVisibilityDate(scheduledDate: string): void {
  if (trackedDate !== scheduledDate) {
    // eslint-disable-next-line sonarjs/no-empty-collection
    hiddenCourtIds.clear();
    trackedDate = scheduledDate;
  }
}

export function getVisibleCourtIds(allCourtIds: string[]): string[] {
  // eslint-disable-next-line sonarjs/no-empty-collection
  return allCourtIds.filter((id) => !hiddenCourtIds.has(id));
}
