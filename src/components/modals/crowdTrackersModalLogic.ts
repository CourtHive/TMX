/**
 * Pure helpers for the crowd trackers modal. Lives in its own file so unit
 * tests can import it without dragging in baseModal (which pulls in
 * courthive-components, which touches `document` at module load).
 */

import type { CrowdScoringSession } from 'services/crowd/scoreRelayClient';

export function buildStatusMessage(count: number): string {
  if (count === 0) return 'No active crowd trackers';
  return `${count} active tracker${count === 1 ? '' : 's'}`;
}

export function decidePrimaryButtonLabel(session: CrowdScoringSession): 'Promote' | 'Demote' {
  return session.trusted ? 'Demote' : 'Promote';
}

export function buildSecondaryLine(
  session: CrowdScoringSession,
  formatTime: (date: Date) => string = (d) => d.toLocaleTimeString(),
): string {
  return `${session.pointHistory.length} pts · v${session.version} · updated ${formatTime(new Date(session.updatedAt))}`;
}
