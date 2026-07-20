/**
 * classifyScorer — TMX-side determination of an incoming crowd score's
 * provenance, run against the loaded tournament's participants.
 *
 * CFS never sees crowd traffic (see Mentat `feedback_cfs_no_crowd_traffic`):
 * the score-relay feeds crowd sessions — each carrying `crowdScoredBy.personId`
 * — directly to TMX, and TMX, which holds the tournament, classifies the scorer:
 *
 *   official     → personId is a participant whose participantRole is OFFICIAL.
 *                  Their real-time scores are authoritative.
 *   scorekeeper  → personId is a participant nominated as this matchUp's
 *                  scorekeeper (matchUp.schedule.scorekeeper) OR who carries the
 *                  SCOREKEEPER role (crowd-scoring Phase D). Trusted — eligible
 *                  for one-click acceptance of their crowd scores.
 *   participant  → personId is a (non-official, non-scorekeeper) participant.
 *   crowd        → a known person who is NOT a tournament participant. The TD
 *                  may nominate them; their score only enters the tournament
 *                  record via an explicit `delegatedOutcome`.
 *   anonymous    → no personId (legacy / un-attributed session).
 *
 * Pure: takes participants + personId (+ optionally the matchUp for the
 * per-matchUp nomination check). Callers fetch participants from the loaded
 * tournamentEngine. Note: `scorekeeper`/`official` establish TRUST; the
 * separate email-`verified` check (from the crowd session) is applied by the
 * accept layer, not here.
 */

// organisationId stamped on `person.personOtherIds[]` by the HiveID claim flow.
// Source of truth is CFS `hiveid.constants.CANONICAL_PERSON`; duplicated here as
// a literal because TMX has no dependency on CFS internals.
const CANONICAL_PERSON = 'CANONICAL_PERSON';
const OFFICIAL_ROLE = 'OFFICIAL';
const SCOREKEEPER_ROLE = 'SCOREKEEPER';

export type ScorerClassification = 'official' | 'scorekeeper' | 'participant' | 'crowd' | 'anonymous';

// Classifications whose real-time crowd scores are trusted (eligible for
// one-click acceptance, subject to the session's email-verified check).
export const TRUSTED_SCORER_CLASSIFICATIONS: ScorerClassification[] = ['official', 'scorekeeper'];

export function isTrustedScorer(classification: ScorerClassification): boolean {
  return TRUSTED_SCORER_CLASSIFICATIONS.includes(classification);
}

export interface ScorerClassificationResult {
  classification: ScorerClassification;
  personId: string | null;
  participantId: string | null;
  participantName: string | null;
}

function matchesCanonicalPerson(participant: any, personId: string): boolean {
  const otherIds: any[] = participant?.person?.personOtherIds ?? [];
  return otherIds.some((o) => o?.organisationId === CANONICAL_PERSON && o?.personId === personId);
}

/** Whether a participant is an approved tournament-wide scorekeeper (carries the
 *  SCOREKEEPER role/responsibility). */
export function isApprovedScorekeeper(participant: any): boolean {
  if (participant?.participantRole === SCOREKEEPER_ROLE) return true;
  return (participant?.participantRoleResponsibilities ?? []).includes(SCOREKEEPER_ROLE);
}

/**
 * Participants who carry a claimed HiveID (any `CANONICAL_PERSON` personOtherId)
 * — the nominable scorekeeper candidates. Only these can be matched to an
 * incoming crowd session's `personId`, so nominating anyone else is inert.
 */
export function hiveIdLinkedParticipants(participants: any[]): any[] {
  return (participants ?? []).filter((participant) =>
    (participant?.person?.personOtherIds ?? []).some(
      (other: any) => other?.organisationId === CANONICAL_PERSON && other?.personId,
    ),
  );
}

function hasScorekeeperRole(participant: any): boolean {
  if (participant?.participantRole === SCOREKEEPER_ROLE) return true;
  const responsibilities: any[] = participant?.participantRoleResponsibilities ?? [];
  return responsibilities.includes(SCOREKEEPER_ROLE);
}

export function classifyScorer(args: {
  participants?: any[];
  personId?: string | null;
  matchUp?: any;
}): ScorerClassificationResult {
  const personId = args?.personId ?? null;
  if (!personId) {
    return { classification: 'anonymous', personId: null, participantId: null, participantName: null };
  }

  const nominatedScorekeeperId = args?.matchUp?.schedule?.scorekeeper ?? null;

  for (const participant of args?.participants ?? []) {
    if (!matchesCanonicalPerson(participant, personId)) continue;
    const participantId = participant?.participantId ?? null;

    let classification: ScorerClassification;
    if (participant?.participantRole === OFFICIAL_ROLE) {
      classification = 'official';
    } else if (hasScorekeeperRole(participant) || (!!nominatedScorekeeperId && participantId === nominatedScorekeeperId)) {
      classification = 'scorekeeper';
    } else {
      classification = 'participant';
    }

    return { classification, personId, participantId, participantName: participant?.participantName ?? null };
  }

  return { classification: 'crowd', personId, participantId: null, participantName: null };
}
