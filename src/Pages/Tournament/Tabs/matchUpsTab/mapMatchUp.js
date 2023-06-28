import { normalizeDiacritics } from 'normalize-text';

export const mapMatchUp = (matchUp) => {
  const { matchUpId, eventName, matchUpType, eventId, roundName, schedule, sides, potentialParticipants, ...rest } =
    matchUp;
  const { scheduledDate, scheduleTime, courtName } = schedule || {};

  const getPotentialName = (participant) => participant.person?.standardFamilyName || participant.participantName;
  const potentials =
    potentialParticipants?.map((potentials) => ({
      participantName: potentials.map(getPotentialName).filter(Boolean).join(' or ')
    })) || [];
  const side1Participant = sides?.[0]?.participant || potentials.shift();
  const side2Participant = sides?.[1]?.participant || potentials.shift();
  const side1 = { participantName: side1Participant?.participantName, sex: side1Participant?.person?.sex };
  const side2 = { participantName: side2Participant?.participantName, sex: side1Participant?.person?.sex };
  const individualParticipantIds = sides
    .flatMap((side) => side.participant?.individualParticipantIds || side.participant?.participantId)
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
    [firstLast, side1Participant?.participantName, side1Participant?.participantName].filter(Boolean).join(' ')
  ).toLowerCase();

  return {
    individualParticipantIds,
    eventType: matchUpType,
    scheduledDate,
    readyToScore,
    scheduleTime,
    matchUpType,
    winningSide,
    searchText,
    courtName,
    eventName,
    matchUpId,
    roundName,
    complete,
    eventId,
    matchUp,
    side1,
    side2,
    score
  };
};
