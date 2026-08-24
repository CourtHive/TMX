/**
 * Reports tab — which participant a click in a report table refers to.
 *
 * Pure and DOM-free on purpose. TMX has no jsdom test layer, so any decision
 * that lives inside a Tabulator formatter closure gets no unit coverage at all;
 * the resolution rules therefore live here and the table only wires them up.
 *
 * ── Why this is not simply `params.participant.participantId` ──
 *
 * `renderParticipant` decides what to hand a click handler by *matchUpType*,
 * not by participant type (`renderParticipant.ts:99`):
 *
 *     const firstParticipant = isDoubles ? participant?.individualParticipants?.[0] : participant;
 *
 * A report row has no matchUp, so `isDoubles` is false and a PAIR arrives as
 * `individualParticipant` — the name is a lie about the shape. Reports that
 * carry entries rather than results (Entry Status, Seeding Performance) do have
 * PAIR rows for every doubles event, so this is a live case rather than a
 * defensive one.
 *
 * `participantProfileModal` is person-oriented throughout — header, ratings,
 * rankings and fingerprint all read `participant.person` — so opening it on a
 * PAIR renders a mostly-empty card. Resolution therefore only ever yields an
 * INDIVIDUAL, and yields nothing when the click cannot name one.
 */

const INDIVIDUAL = 'INDIVIDUAL';

/** Only the fields click resolution reads. Reports hydrate participants via `getParticipants`. */
export interface ReportParticipant {
  individualParticipants?: ReportParticipant[];
  participantType?: string;
  participantId?: string;
}

/** A report row, as the factory report wrappers emit it plus the table's hydration. */
export interface ReportRow {
  winnerParticipant?: ReportParticipant;
  side1Participant?: ReportParticipant;
  side2Participant?: ReportParticipant;
  winningParticipantId?: string;
  participant?: ReportParticipant;
  side1ParticipantId?: string;
  side2ParticipantId?: string;
  participantId?: string;
}

/**
 * Row keys carrying a participant id, and the hydrated key each resolves into.
 *
 * `participantId` is the participant-grain reports (one row per participant);
 * the side keys are the matchUp-grain ones, where a row names two opponents and
 * neither is "the" participant of the row. `winningParticipantId` is the winner
 * columns — one hydrated key serves both Match Results and the Draw Structure
 * report, since a row has exactly one winner.
 */
export const PARTICIPANT_ID_KEYS = [
  { idKey: 'participantId', hydratedKey: 'participant' },
  { idKey: 'side1ParticipantId', hydratedKey: 'side1Participant' },
  { idKey: 'side2ParticipantId', hydratedKey: 'side2Participant' },
  { idKey: 'winningParticipantId', hydratedKey: 'winnerParticipant' },
] as const;

/**
 * The one individual a candidate names, or undefined.
 *
 * A PAIR holding exactly one individual is unambiguous and resolves to that
 * individual — degenerate data, but there is only one answer. A PAIR holding two
 * resolves to nothing: picking the first would open a card for whichever partner
 * happened to be stored first, which is worse than doing nothing.
 */
function individualOf(candidate?: ReportParticipant): string | undefined {
  if (!candidate) return undefined;
  if (candidate.participantType === INDIVIDUAL) return candidate.participantId || undefined;
  const individuals = candidate.individualParticipants ?? [];
  if (individuals.length === 1) return individuals[0]?.participantId || undefined;
  return undefined;
}

/**
 * Resolve the participantId whose card a report click should open.
 *
 * Returns undefined when the click cannot name a single individual — the caller
 * must then do nothing rather than open an empty card.
 */
export function resolveReportParticipantId(params?: {
  individualParticipant?: ReportParticipant;
  participant?: ReportParticipant;
}): string | undefined {
  return individualOf(params?.individualParticipant) ?? individualOf(params?.participant);
}

/**
 * Every individual participantId the table holds, in row order and deduped.
 *
 * Drives prev/next navigation inside the participant card, so it must span the
 * whole table rather than the clicked row: a PAIR row contributes both of its
 * individuals, in the order they are stored.
 */
export function collectReportParticipantIds(rows: ReportRow[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  const add = (participantId?: string) => {
    if (!participantId || seen.has(participantId)) return;
    seen.add(participantId);
    ids.push(participantId);
  };

  const addParticipant = (participant?: ReportParticipant) => {
    if (!participant) return;
    if (participant.participantType === INDIVIDUAL) {
      add(participant.participantId);
      return;
    }
    for (const individual of participant.individualParticipants ?? []) add(individual?.participantId);
  };

  for (const row of rows ?? []) {
    // Both sides of a matchUp-grain row contribute, side 1 first, so prev/next
    // walks the table in the order it reads.
    for (const { hydratedKey } of PARTICIPANT_ID_KEYS) addParticipant((row as any)?.[hydratedKey]);
  }

  return ids;
}
