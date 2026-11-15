import {
  STATUS_BUCKETS,
  statusBucketOf,
  type StatusBucket,
} from 'components/tables/common/filters/matchUpStatusPredicates';
import { factoryConstants } from 'tods-competition-factory';
import { getMatchUpCheckInState } from './checkInState';

const COMPLETED = new Set<string>(factoryConstants.completedMatchUpStatuses);
export type CheckInFilter = 'all' | 'awaiting' | 'partial' | 'complete';
export interface DeskFilters {
  search: string;
  status: CheckInFilter;
  eventId: string;
  venueId: string;
  /** the status chips that are on; `undefined` is every chip on */
  buckets?: string[];
}

/** The desk opens on matches still to be played: one with a score is on court or done, past the desk (CA 11-15). */
export const DEFAULT_DESK_BUCKETS: StatusBucket[] = ['toBePlayed'];

/**
 * The matchUps table's status bucket for a hydrated matchUp. The table classifies its mapped rows; this hands
 * `statusBucketOf` the same fields from the engine's matchUp (mapMatchUp.ts), so the chips mean the same thing here.
 */
export function deskStatusBucket(matchUp: any): StatusBucket {
  const matchUpStatus = matchUp.matchUpStatus;
  return statusBucketOf({
    matchUpStatus,
    winningSide: matchUp.winningSide,
    complete: COMPLETED.has(matchUpStatus),
    score: matchUp.score?.scoreStringSide1,
    readyToScore: matchUp.readyToScore,
  });
}

const fold = (value: string) => value.normalize('NFD').replaceAll(/[̀-ͯ]/g, '').toLocaleLowerCase();

/** Every desk filter but the status chips: the population the chips count and then narrow. */
function passesOthers(matchUp: any, date: string, filters: DeskFilters, search: string): boolean {
  if (matchUp.schedule?.scheduledDate !== date || matchUp.matchUpStatus === 'BYE') return false;
  if (filters.eventId && matchUp.eventId !== filters.eventId) return false;
  if (filters.venueId && matchUp.schedule?.venueId !== filters.venueId) return false;
  const state = getMatchUpCheckInState(matchUp);
  if (!state.hasParticipants) return false;
  if (filters.status === 'awaiting' && state.allCheckedIn) return false;
  if (filters.status === 'partial' && !state.partial) return false;
  if (filters.status === 'complete' && !state.allCheckedIn) return false;
  return (
    !search || fold(state.participants.map((participant) => participant.participantName).join(' ')).includes(search)
  );
}

/** Date-scoped, draw-type independent and never mutates the engine's array. */
export function checkInDeskMatchUps(matchUps: any[], date: string, filters: DeskFilters): any[] {
  const search = fold(filters.search.trim());
  const buckets = filters.buckets && new Set(filters.buckets);
  return matchUps
    .filter((matchUp) => passesOthers(matchUp, date, filters, search))
    .filter((matchUp) => !buckets || buckets.has(deskStatusBucket(matchUp)))
    .toSorted(
      (a, b) =>
        (a.schedule?.scheduledTime || '99:99').localeCompare(b.schedule?.scheduledTime || '99:99') ||
        (a.schedule?.courtName || '').localeCompare(b.schedule?.courtName || '', undefined, { numeric: true }) ||
        a.matchUpId.localeCompare(b.matchUpId),
    );
}

/** A chip's count is the cards it would show: every other filter applied, the status chips themselves not. */
export function deskBucketCounts(matchUps: any[], date: string, filters: DeskFilters): Record<StatusBucket, number> {
  const counts = Object.fromEntries(STATUS_BUCKETS.map((bucket) => [bucket, 0])) as Record<StatusBucket, number>;
  const search = fold(filters.search.trim());
  for (const matchUp of matchUps) {
    if (passesOthers(matchUp, date, filters, search)) counts[deskStatusBucket(matchUp)] += 1;
  }
  return counts;
}

/** participantId → sex for every individual on the matchUp's sides, a pair's or team's members included. */
export function participantSexes(matchUp: any): Map<string, string> {
  const sexes = new Map<string, string>();
  const add = (participant: any) => {
    const sex = participant?.person?.sex;
    if (participant?.participantId && sex) sexes.set(participant.participantId, sex);
  };
  for (const side of matchUp.sides ?? []) {
    add(side.participant);
    for (const member of side.participant?.individualParticipants ?? []) add(member);
  }
  return sexes;
}
