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
 *   participant  → personId is a (non-official) participant in the tournament.
 *   crowd        → a known person who is NOT a tournament participant. The TD
 *                  may nominate them; their score only enters the tournament
 *                  record via an explicit `delegatedOutcome`.
 *   anonymous    → no personId (legacy / un-attributed session).
 *
 * Pure: takes participants + personId. Callers fetch participants from the
 * loaded tournamentEngine.
 */

// organisationId stamped on `person.personOtherIds[]` by the HiveID claim flow.
// Source of truth is CFS `hiveid.constants.CANONICAL_PERSON`; duplicated here as
// a literal because TMX has no dependency on CFS internals.
const CANONICAL_PERSON = 'CANONICAL_PERSON';
const OFFICIAL_ROLE = 'OFFICIAL';

export type ScorerClassification = 'official' | 'participant' | 'crowd' | 'anonymous';

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

export function classifyScorer(args: { participants?: any[]; personId?: string | null }): ScorerClassificationResult {
  const personId = args?.personId ?? null;
  if (!personId) {
    return { classification: 'anonymous', personId: null, participantId: null, participantName: null };
  }

  for (const participant of args?.participants ?? []) {
    if (!matchesCanonicalPerson(participant, personId)) continue;
    const isOfficial = participant?.participantRole === OFFICIAL_ROLE;
    return {
      classification: isOfficial ? 'official' : 'participant',
      personId,
      participantId: participant?.participantId ?? null,
      participantName: participant?.participantName ?? null,
    };
  }

  return { classification: 'crowd', personId, participantId: null, participantName: null };
}
