/**
 * Pure helpers for the crowd trackers modal. Lives in its own file so unit
 * tests can import it without dragging in baseModal (which pulls in
 * courthive-components, which touches `document` at module load).
 */

import { classifyScorer, type ScorerClassification } from 'services/crowd/classifyScorer';
import type { CrowdScoringSession } from 'services/crowd/scoreRelayClient';
import { t } from 'i18n';

export interface SessionScorerInfo {
  classification: ScorerClassification;
  participantName: string | null;
  verified: boolean;
  /** Whether the TD may nominate this scorer as the matchUp's trusted scorer. */
  nominatable: boolean;
  /** When not nominatable, a short reason for a tooltip. */
  reason?: string;
}

/**
 * Determine an incoming crowd session's scorer provenance + nomination
 * eligibility, classifying the relay-attested `crowdScoredBy.personId` against
 * the loaded tournament participants. CFS never sees this — the relay feeds TMX
 * (see Mentat `feedback_cfs_no_crowd_traffic`).
 *
 * Nominatable = a known, trusted identity: tournament participants/officials
 * (trusted by being entered in the tournament) OR a verified crowd person.
 * Anonymous sessions and unverified crowd people are not nominatable.
 */
export function resolveSessionScorer(
  session: CrowdScoringSession,
  participants: any[],
  matchUp?: any,
): SessionScorerInfo {
  const personId = session.crowdScoredBy?.personId ?? null;
  const verified = session.crowdScoredBy?.verified === true;
  const { classification, participantName } = classifyScorer({ participants, personId, matchUp });

  let nominatable = true;
  let reason: string | undefined;
  if (classification === 'anonymous') {
    nominatable = false;
    reason = t('crowd.reason.signInRequired');
  } else if (classification === 'crowd' && !verified) {
    nominatable = false;
    reason = t('crowd.reason.emailNotVerified');
  }

  return { classification, participantName, verified, nominatable, reason };
}

export function scorerBadgeLabel(classification: ScorerClassification): string {
  switch (classification) {
    case 'official':
      return t('crowd.badge.official');
    case 'scorekeeper':
      return t('crowd.badge.scorekeeper');
    case 'participant':
      return t('crowd.badge.participant');
    case 'crowd':
      return t('crowd.badge.crowd');
    default:
      return t('crowd.badge.anon');
  }
}

export function buildStatusMessage(count: number): string {
  if (count === 0) return t('crowd.noActiveTrackers');
  return t('crowd.activeTrackers', { count });
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
