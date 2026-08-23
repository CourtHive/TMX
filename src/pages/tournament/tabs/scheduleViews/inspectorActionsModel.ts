/**
 * Schedule2 — what the Inspector's actions popover can offer, as data.
 *
 * Pure and DOM-free, for the same reason `participantRest.ts` is: TMX runs its
 * unit suite without a DOM, so a decision embedded in element construction gets
 * no coverage at all. The rules about *which* participants are offerable — and
 * what a side contributes when its players are not yet known — live here; the
 * element assembly lives in `inspectorActions.ts`.
 *
 * The catalog cannot host this menu. Its cards are natively `draggable`, so a
 * press-and-hold competes with drag initiation, and the catalog rebuilds every
 * card on every state change, which orphans anything anchored to one. The
 * Inspector has a single stable target per selection and is where the operator
 * already is once they have chosen a matchUp.
 */

import { matchUpLabel } from './matchUpReadiness';

// constants and types
import type { ReadinessMatchUp, ReadinessSide } from './matchUpReadiness';

export interface InspectorActionParticipant {
  participantId: string;
  participantName: string;
}

export interface InspectorActionModel {
  matchUpId: string;
  /** Needed by `navigateToEvent`, which resolves draw and structure from the matchUp. */
  eventId?: string;
  /** `R16: Alice Smith vs Bob Jones` — the popover's own heading. */
  label: string;
  /** Individuals whose participant card can be opened. Empty when the sides are still TBD. */
  participants: InspectorActionParticipant[];
}

/**
 * The individuals one side contributes.
 *
 * A hydrated pair or team carries `individualParticipants`, and those are the
 * people a director wants to open — `nameFor` deliberately returns the *side*
 * label, which would list one doubles pair's name twice and offer neither
 * player. A side with no members falls back to the side participant itself
 * (a singles player, or a pair whose members were not hydrated); a side with
 * no participant at all is still TBD and contributes nothing, because there is
 * no card to open.
 */
function sideParticipants(side: ReadinessSide): InspectorActionParticipant[] {
  const members = side.participant?.individualParticipants ?? [];
  const named = members
    .filter((member) => member?.participantId)
    .map((member) => ({
      participantId: member.participantId as string,
      participantName: member.participantName ?? (member.participantId as string),
    }));
  if (named.length) return named;

  const participantId = side.participantId ?? side.participant?.participantId;
  if (!participantId) return [];
  return [
    { participantId, participantName: side.participant?.participantName ?? side.participantName ?? participantId },
  ];
}

/** The offerable actions for one matchUp, or undefined when it is no longer in the tournament. */
export function buildInspectorActionModel(
  matchUpId: string,
  matchUps: ReadinessMatchUp[],
): InspectorActionModel | undefined {
  const matchUp = matchUps.find((candidate) => candidate.matchUpId === matchUpId);
  if (!matchUp) return undefined;

  // Deduped because a team event can carry the same individual on both the team
  // side and its hydrated members, and offering one person twice reads as a bug.
  const seen = new Set<string>();
  const participants: InspectorActionParticipant[] = [];
  for (const side of matchUp.sides ?? []) {
    for (const participant of sideParticipants(side)) {
      if (seen.has(participant.participantId)) continue;
      seen.add(participant.participantId);
      participants.push(participant);
    }
  }

  return { matchUpId, eventId: matchUp.eventId, label: matchUpLabel(matchUp), participants };
}
