/**
 * Kept in its OWN module, free of DOM imports: `createTournamentsTable` pulls in
 * `courthive-components`, which touches `document` at module load, so a node-environment unit test
 * cannot import anything from it. The rule below is exactly the part worth testing.
 */

/**
 * WHICH calendar feed the tournaments list reads.
 *
 * Three sources, and the difference between the first two is what a director sees:
 *   - `my-calendars` — the OPERATOR feed, includes unpublished tournaments. For anyone logged in.
 *   - `public`       — the public provider calendar, PUBLISHED ONLY. For a logged-out visitor
 *                      who still has a provider in scope (branding, a shared link).
 *   - `local`        — IndexedDB, for offline / local-only work with no provider at all.
 *
 * Pure so the choice is testable without a DOM or a network: the bug it exists to prevent is a
 * LOGGED-IN caller being handed the published-only feed, which looks exactly like data loss.
 */
export type CalendarSource = 'my-calendars' | 'public' | 'local';

export function resolveCalendarSource({
  authenticated,
  providerAbbr,
}: {
  authenticated: boolean;
  providerAbbr?: string;
}): CalendarSource {
  if (authenticated) return 'my-calendars';
  if (providerAbbr) return 'public';
  return 'local';
}
