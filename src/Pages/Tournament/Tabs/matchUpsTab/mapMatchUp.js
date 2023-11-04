import { eventConstants } from 'tods-competition-factory';
import { normalizeDiacritics } from 'normalize-text';

const { TEAM } = eventConstants;

export const mapMatchUp = (matchUp) => {
  const {
    matchUpId,
    drawId,
    eventName,
    matchUpType,
    eventId,
    roundName,
    schedule,
    sides,
    potentialParticipants,
    ...rest
  } = matchUp;
  const { scheduledDate, scheduleTime, courtName } = schedule || {};

  const getPotentialName = (participant) => participant.person?.standardFamilyName || participant.participantName;
  const potentials =
    potentialParticipants?.map((potentials) => ({
      participantName: potentials.map(getPotentialName).filter(Boolean).join(' or ')
    })) || [];
  const side1Participant = sides?.[0]?.participant || potentials.shift();
  const side2Participant = sides?.[1]?.participant || potentials.shift();
  const side1 = {
    participantName: side1Participant?.participantName,
    sex: side1Participant?.person?.sex,
    participant: side1Participant
  };
  const side2 = {
    participantName: side2Participant?.participantName,
    sex: side2Participant?.person?.sex,
    participant: side2Participant
  };
  const individualParticipantIds = sides
    .flatMap(({ participant }) =>
      participant?.individualParticipantIds?.length ? participant.individualParticipantIds : participant?.participantId
    )
    .filter(Boolean);

  const winningSide = (rest.winningSide === 1 && 'side1') || (rest.winningSide === 2 && 'side2') || undefined;
  const complete = !!rest.winningSide;

  const readyToScore = !!(rest.winningSide || rest.readyToScore);
  const score = rest.score?.scoreStringSide1;

  const firstLast = sides
    .flatMap((side) => {
      const person = side.participant?.person;
      return person && [person.standardGivenName, person.standardFamilyName];
    })
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const searchText = normalizeDiacritics(
    [firstLast, side1Participant?.participantName, side2Participant?.participantName].filter(Boolean).join(' ')
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
    scheduleTime,
    matchUpType,
    scoreDetail,
    winningSide,
    searchText,
    courtName,
    eventName,
    eventType,
    matchUpId,
    roundName,
    complete,
    eventId,
    matchUp,
    drawId,
    side1,
    side2,
    score
  };
};
