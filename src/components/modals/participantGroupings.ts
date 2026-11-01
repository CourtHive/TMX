/**
 * Pure assembly of the pairs, teams and groups a participant belongs to, for the participant card.
 *
 * Reads the `participantMap` that `getParticipants` already returns beside `participants` (it holds every
 * participant in the tournament, so no second query is needed). The factory hydrates each individual there with
 * `pairParticipantIds` / `teamParticipantIds` / `groupParticipantIds`, and each mapped participant with its event
 * entries (`events`, keyed by eventId) when the query asks for events — so nothing here scans participants for
 * membership by hand.
 */
import { entryStatusConstants } from 'tods-competition-factory';

const { WITHDRAWN } = entryStatusConstants;

export type GroupingEvent = {
  entryStatus?: string;
  eventName: string;
  eventId: string;
};

export type GroupingMember = {
  participantName: string;
  participantId: string;
};

export type GroupingMembership = {
  participantName: string;
  participantId: string;
  events: GroupingEvent[];
  /** At least one event entry that is not WITHDRAWN. */
  entered: boolean;
};

export type PairMembership = GroupingMembership & {
  partners: GroupingMember[];
};

export type ParticipantGroupings = {
  pairs: PairMembership[];
  teams: GroupingMembership[];
  groups: GroupingMembership[];
};

type MappedParticipant = {
  participant?: {
    participantName?: string;
    participantId?: string;
    individualParticipantIds?: string[];
    pairParticipantIds?: string[];
    teamParticipantIds?: string[];
    groupParticipantIds?: string[];
  };
  // keyed by eventId; the factory types it loosely as an array or a record, and Object.values reads either
  events?: Record<string, any> | any[];
};

type GroupingsArgs = {
  participantMap?: Record<string, MappedParticipant>;
  events?: { eventId: string; eventName?: string }[];
  participantId: string;
};

const byName = (a: { participantName: string }, b: { participantName: string }) =>
  a.participantName.localeCompare(b.participantName, undefined, { numeric: true });

function membershipFor(
  groupingId: string,
  participantMap: Record<string, MappedParticipant>,
  eventNames: Map<string, string>,
) {
  const mapped = participantMap[groupingId];
  if (!mapped?.participant) return undefined;
  const events: GroupingEvent[] = Object.values(mapped.events ?? {})
    .map(({ eventId, entryStatus }) => ({ eventId, entryStatus, eventName: eventNames.get(eventId) ?? eventId }))
    .sort((a, b) => a.eventName.localeCompare(b.eventName, undefined, { numeric: true }));
  return {
    participantName: mapped.participant.participantName ?? groupingId,
    entered: events.some(({ entryStatus }) => entryStatus !== WITHDRAWN),
    participantId: groupingId,
    events,
  };
}

function memberOf(participantId: string, participantMap: Record<string, MappedParticipant>): GroupingMember {
  return {
    participantName: participantMap[participantId]?.participant?.participantName ?? participantId,
    participantId,
  };
}

/** The pairs, teams and groups `participantId` belongs to; every list is empty for a participant in none. */
export function getParticipantGroupings({
  participantId,
  participantMap,
  events,
}: GroupingsArgs): ParticipantGroupings {
  const individual = participantMap?.[participantId]?.participant;
  if (!participantMap || !individual) return { pairs: [], teams: [], groups: [] };

  const eventNames = new Map((events ?? []).map(({ eventId, eventName }) => [eventId, eventName ?? eventId]));
  const memberships = (ids?: string[]): GroupingMembership[] =>
    (ids ?? [])
      .map((id) => membershipFor(id, participantMap, eventNames))
      .filter((membership): membership is GroupingMembership => !!membership)
      .sort(byName);

  const pairs: PairMembership[] = memberships(individual.pairParticipantIds).map((pair) => ({
    ...pair,
    partners: (participantMap[pair.participantId]?.participant?.individualParticipantIds ?? [])
      .filter((id) => id !== participantId)
      .map((id) => memberOf(id, participantMap)),
  }));

  return {
    pairs,
    teams: memberships(individual.teamParticipantIds),
    groups: memberships(individual.groupParticipantIds),
  };
}

/** The individuals of a PAIR (or any grouping), in stored order; empty for an individual. */
export function getGroupingMembers({ participantId, participantMap }: GroupingsArgs): GroupingMember[] {
  if (!participantMap) return [];
  const individualParticipantIds = participantMap[participantId]?.participant?.individualParticipantIds ?? [];
  return individualParticipantIds.map((id) => memberOf(id, participantMap));
}

/**
 * Whether the import-wizard team affiliation (`teamAttributes[0].teamName`) names a team the participant is
 * already shown as a member of. Affiliation is a free-text attribute on the person; membership is a TEAM
 * participant holding them. When they agree, the card shows the membership only.
 */
export function affiliationIsMembership(affiliation: string | undefined, teams: GroupingMembership[]): boolean {
  if (!affiliation) return false;
  const name = affiliation.trim().toLowerCase();
  return teams.some(({ participantName }) => participantName.trim().toLowerCase() === name);
}
