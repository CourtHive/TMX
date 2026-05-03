/**
 * Map matchUp data for table display.
 * Transforms matchUp objects into table-ready format with participant details.
 */
import { eventConstants, factoryConstants, tournamentEngine } from 'tods-competition-factory';
import { normalizeDiacritics } from 'normalize-text';

const { TEAM } = eventConstants;
const { completedMatchUpStatuses } = factoryConstants;

export const mapMatchUp = (matchUp: any): any => {
  const {
    potentialParticipants,
    matchUpType,
    matchUpId,
    eventName,
    roundName,
    schedule,
    eventId,
    drawId,
    gender,
    sides,
    ...rest
  } = matchUp;

  const { scheduledDate, scheduledTime, courtName, startTime, endTime, official: officialId } = schedule || {};
  const official = officialId
    ? tournamentEngine.getParticipants({ participantFilters: { participantIds: [officialId] } })?.participants?.[0]
        ?.participantName || officialId
    : undefined;

  const getPotentialName = (participant: any) => participant.person?.standardFamilyName || participant.participantName;
  const potentials =
    potentialParticipants?.map((potentials: any) => ({
      participantName: potentials.map(getPotentialName).filter(Boolean).join(' or '),
    })) || [];
  const side1Participant = sides?.[0]?.participant || potentials.shift();
  const side2Participant = sides?.[1]?.participant || potentials.shift();
  const side1 = {
    participantName: side1Participant?.participantName,
    sex: side1Participant?.person?.sex,
    participant: side1Participant,
  };
  const side2 = {
    participantName: side2Participant?.participantName,
    sex: side2Participant?.person?.sex,
    participant: side2Participant,
  };
  const individualParticipantIds = sides
    .flatMap(({ participant }: any) =>
      participant?.individualParticipantIds?.length ? participant.individualParticipantIds : participant?.participantId,
    )
    .filter(Boolean);

  const winningSide = (rest.winningSide === 1 && 'side1') || (rest.winningSide === 2 && 'side2') || undefined;
  const complete = completedMatchUpStatuses.includes(matchUp.matchUpStatus);

  const readyToScore = !!(rest.winningSide || rest.readyToScore);
  const score = rest.score?.scoreStringSide1;

  const firstLast = sides
    .flatMap((side: any) => {
      const person = side.participant?.person;
      if (person) return [person.standardGivenName, person.standardFamilyName];
      return side.participant?.individualParticipants?.map(({ person }: any) => [
        person.standardGivenName,
        person.standardFamilyName,
      ]);
    })
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const searchText = normalizeDiacritics(
    [firstLast, side1Participant?.participantName, side2Participant?.participantName].filter(Boolean).join(' '),
  ).toLowerCase();

  const eventType = matchUp.collectionId ? TEAM : matchUpType;

  const competitiveProfile = matchUp.competitiveness
    ? { competitiveness: matchUp.competitiveness }
    : matchUp.competitiveProfile;

  const scoreDetail = { score, matchUpStatus: matchUp.matchUpStatus, readyToScore, complete, winningSide };

  return {
    matchUpStatus: matchUp.matchUpStatus,
    individualParticipantIds,
    flight: matchUp.drawName,
    competitiveProfile,
    scheduledDate,
    readyToScore,
    scheduledTime,
    matchUpType,
    scoreDetail,
    winningSide,
    searchText,
    startTime,
    courtName,
    eventName,
    eventType,
    matchUpId,
    official,
    roundName,
    complete,
    endTime,
    eventId,
    matchUp,
    gender,
    drawId,
    side1,
    side2,
    score,
    // ISO UTC string stamped by factory on every matchUp modification.
    // Surfaced as an initially-hidden "Updated" column — scorekeepers
    // and admins can enable it to spot stale vs freshly-touched rows.
    updatedAt: matchUp.updatedAt,
  };
};
