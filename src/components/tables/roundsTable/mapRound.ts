import { MATCHUP_STATUS_DISPLAY } from '../common/formatters/matchUpStatusDisplay';
import { scoreActionPermitted } from 'services/transitions/scoreActionPermitted';
import { eventConstants, factoryConstants } from 'tods-competition-factory';
import { normalizeDiacritics } from 'normalize-text';

const { TEAM } = eventConstants;
const { completedMatchUpStatuses } = factoryConstants;

export const mapRound = (matchUp: any): any => {
  const {
    potentialParticipants,
    structureName,
    matchUpType,
    roundNumber,
    matchUpId,
    roundName,
    schedule,
    eventId,
    drawId,
    sides,
    ...rest
  } = matchUp;

  const { scheduledDate, scheduleTime, courtName } = schedule || {};

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
  // Whether the empty score cell may advertise entry. Asked of the factory once per row as the table data is
  // built, and only where the cell would otherwise be empty; the click handler asks again before opening.
  const scorePermitted =
    readyToScore &&
    !score &&
    !MATCHUP_STATUS_DISPLAY[matchUp.matchUpStatus] &&
    scoreActionPermitted({ drawId, matchUpId });

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
    structureName,
    scheduledDate,
    scorePermitted,
    readyToScore,
    scheduleTime,
    matchUpType,
    scoreDetail,
    winningSide,
    roundNumber,
    searchText,
    courtName,
    eventType,
    matchUpId,
    roundName,
    complete,
    eventId,
    matchUp,
    drawId,
    side1,
    side2,
    score,
  };
};
