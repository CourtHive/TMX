/**
 * Map matchUp data for table display.
 * Transforms matchUp objects into table-ready format with participant details.
 */
import { MATCHUP_STATUS_DISPLAY } from 'components/tables/common/formatters/matchUpStatusDisplay';
import { isScheduleLocked } from 'pages/tournament/tabs/scheduleViews/scheduleLocks';
import { scoreActionPermitted } from 'services/transitions/scoreActionPermitted';
import { eventConstants, factoryConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { hasFinalResult } from 'functions/hasFinalResult';
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

  const {
    scheduledDate,
    scheduledTime,
    courtName,
    startTime,
    endTime,
    calledAt,
    official: officialId,
  } = schedule || {};
  const official = officialId
    ? tournamentEngine.q.participants({ participantFilters: { participantIds: [officialId] } })?.[0]?.participantName ||
      officialId
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

  // A completed points-total tie (16-16, COMPLETED, no winner) is no longer readyToScore (factory 7.11.0) and has no
  // winner, but its score is still shown.
  const readyToScore = !!(rest.winningSide || rest.readyToScore || hasFinalResult(rest));
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

  // Schedule lock, decided by the factory predicate rather than by reading
  // `schedule.lock` here — a lock is inert once the matchUp completes or while
  // it has no placement, and the column must not claim otherwise.
  const scheduleLocked = isScheduleLocked(matchUp);
  const lockReason = schedule?.lock?.reason;

  return {
    matchUpStatus: matchUp.matchUpStatus,
    individualParticipantIds,
    flight: matchUp.drawName,
    competitiveProfile,
    scheduleLocked,
    scheduledDate,
    scorePermitted,
    readyToScore,
    scheduledTime,
    lockReason,
    matchUpType,
    scoreDetail,
    winningSide,
    searchText,
    startTime,
    courtName,
    calledAt,
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
