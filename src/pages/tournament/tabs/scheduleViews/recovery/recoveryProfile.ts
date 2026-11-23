/**
 * Rain-day recovery, T1 (Mentat planning/RAIN_DAY_RECOVERY_PLAN.md § 4.3): the one-date scheduling profile a recovery
 * projects. Pure: the caller hands in the carryover and the target day's matchUps; nothing is read or written.
 *
 * - The **carryover** (matchUps still dated on the interrupted day without a result) comes first, one profile round per
 *   draw round, in the order the carryover is given. It carries **no** `notBeforeTime` (CA 2026-11-23): a postponed
 *   matchUp never inherits the time the interrupted day gave it, so it starts as early as its own constraints allow.
 * - The **target day's own** matchUps follow, one profile round per draw round and imported start, each held to that
 *   start (`notBeforeTime`, honored by the factory since G5). Under the `finish` release policy no target-day round starts
 *   before the carryover's projected finish either.
 *
 * The target day is the day after the interrupted day (CA 2026-11-23): this module takes it as a date and names no
 * weekday.
 */
import { tools } from 'tods-competition-factory';

export type ReleasePolicy = 'ready' | 'finish';

/** the round a matchUp belongs to, as a scheduling profile names it */
type RoundKey = { tournamentId: string; eventId: string; drawId: string; structureId: string; roundNumber: number };

/** an inContext matchUp: the factory types its round identity as optional, though a drawn matchUp always has it */
export type RecoveryMatchUp = Partial<RoundKey> & {
  matchUpId: string;
  /** the matchUp's stored schedule: its venue, and on the target day its imported start */
  schedule?: { venueId?: string; scheduledTime?: string };
};

export type RecoveryProfileRound = RoundKey & { matchUpIds: string[]; notBeforeTime?: string };

export type RecoveryProfile = {
  schedulingProfile: { scheduleDate: string; venues: { venueId: string; rounds: RecoveryProfileRound[] }[] }[];
  /** matchUps with no venue of their own and no default to fall back to: left out, so the caller can say so */
  unvenuedMatchUpIds: string[];
  /** matchUps without the round identity a profile round needs: left out, so the caller can say so */
  unroundedMatchUpIds: string[];
};

function roundKeyOf({
  tournamentId,
  eventId,
  drawId,
  structureId,
  roundNumber,
}: RecoveryMatchUp): RoundKey | undefined {
  if (!tournamentId || !eventId || !drawId || !structureId || !roundNumber) return undefined;
  return { tournamentId, eventId, drawId, structureId, roundNumber };
}

type RecoveryProfileArgs = {
  /** the carryover, in the order it should be offered slots (analyzeCarryover's: oldest first) */
  carryover: RecoveryMatchUp[];
  /** the target day's scheduled, unresulted matchUps; their scheduledTime is the imported start */
  targetDay: RecoveryMatchUp[];
  /** `YYYY-MM-DD` */
  scheduleDate: string;
  releasePolicy: ReleasePolicy;
  /** `finish` only: the carryover's projected finish (`HH:MM`), from a carryover-only run; absent, nothing is raised */
  carryoverFinishTime?: string;
  /** the venue for a matchUp whose schedule names none */
  defaultVenueId?: string;
};

const minutes = (time: string) => tools.dateTime.timeStringMinutes(time);
const later = (a: string, b?: string) => (b && minutes(b) > minutes(a) ? b : a);

export function importedStart(matchUp: RecoveryMatchUp): string | undefined {
  const scheduledTime = matchUp.schedule?.scheduledTime;
  return scheduledTime ? tools.dateTime.extractTime(scheduledTime) || undefined : undefined;
}

export function buildRecoveryProfile({
  carryoverFinishTime,
  defaultVenueId,
  releasePolicy,
  scheduleDate,
  carryover,
  targetDay,
}: RecoveryProfileArgs): RecoveryProfile {
  const venueRounds = new Map<string, Map<string, RecoveryProfileRound>>();
  const unvenuedMatchUpIds: string[] = [];
  const unroundedMatchUpIds: string[] = [];

  const add = (matchUp: RecoveryMatchUp, notBeforeTime?: string) => {
    const roundKey = roundKeyOf(matchUp);
    if (!roundKey) {
      unroundedMatchUpIds.push(matchUp.matchUpId);
      return;
    }
    const venueId = matchUp.schedule?.venueId || defaultVenueId;
    if (!venueId) {
      unvenuedMatchUpIds.push(matchUp.matchUpId);
      return;
    }
    const { tournamentId, drawId, structureId, roundNumber } = roundKey;
    const key = [tournamentId, drawId, structureId, roundNumber, notBeforeTime ?? ''].join('|');
    if (!venueRounds.has(venueId)) venueRounds.set(venueId, new Map());
    const rounds = venueRounds.get(venueId)!;
    if (!rounds.has(key)) {
      const round: RecoveryProfileRound = { ...roundKey, matchUpIds: [] };
      if (notBeforeTime) round.notBeforeTime = notBeforeTime;
      rounds.set(key, round);
    }
    rounds.get(key)!.matchUpIds.push(matchUp.matchUpId);
  };

  // the carryover first, in its own order, held by nothing but its own constraints
  for (const matchUp of carryover) add(matchUp);

  // then the target day's matchUps by imported start; one without a start is offered last, unheld
  const timed = targetDay
    .map((matchUp) => ({ matchUp, start: importedStart(matchUp) }))
    .toSorted((a, b) => (a.start ? minutes(a.start) : Infinity) - (b.start ? minutes(b.start) : Infinity));
  for (const { matchUp, start } of timed) {
    const notBeforeTime = start && (releasePolicy === 'finish' ? later(start, carryoverFinishTime) : start);
    add(matchUp, notBeforeTime);
  }

  const venues = [...venueRounds.entries()].map(([venueId, rounds]) => ({ venueId, rounds: [...rounds.values()] }));
  return { schedulingProfile: [{ scheduleDate, venues }], unvenuedMatchUpIds, unroundedMatchUpIds };
}
