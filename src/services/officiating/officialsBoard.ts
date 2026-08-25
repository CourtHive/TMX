/**
 * The officials board — who is on which court right now, who is free, who has been working.
 *
 * P0 of TMX_OFFICIALS_COORDINATION: read-only, derived entirely from data the factory already
 * hydrates. No schema change, no AMS registry, no declarations service, no factory work.
 *
 * **D5 (CA, 2026-08-24): all four states derive. Nothing is persisted.**
 *
 * | state | derivation |
 * |---|---|
 * | `onCourt` | an assigned matchUp is in progress |
 * | `assigned` | an assigned matchUp for this date has not started |
 * | `waiting` | signed in **on this date**, holding no current assignment |
 * | `available` | has the OFFICIAL role, not signed in today — engaged, but not known to be here |
 *
 * The plan called `waiting` "not derivable — a fact about the physical world". That holds only if
 * arrival goes unrecorded, and `SIGN_IN_STATUS` records exactly that, role-agnostically. Deriving it
 * keeps officials and volunteers on **one** presence model rather than two.
 *
 * Pure and DOM-free: TMX has no jsdom, so a decision made inside a renderer gets no unit coverage.
 */

import { signedInOnDate, localCalendarDate } from 'services/presence/signInPresence';
import { participantRoles } from 'tods-competition-factory';

// constants and types
const { OFFICIAL } = participantRoles;

const IN_PROGRESS = 'IN_PROGRESS';
const SUSPENDED = 'SUSPENDED';

const COMPLETED_STATUSES = new Set([
  'CANCELLED',
  'ABANDONED',
  'COMPLETED',
  'DEAD_RUBBER',
  'DEFAULTED',
  'DOUBLE_WALKOVER',
  'DOUBLE_DEFAULT',
  'RETIRED',
  'WALKOVER',
]);

/**
 * A matchUp longer than this is not a match, it is an unclosed timer.
 *
 * `matchUpDuration` adds a live-elapsed term for anything started and not ended, so an operator who
 * forgets to stop the clock makes "time on court today" grow without bound. Twelve hours covers any
 * real match including a long weather suspension, and matches the factory's own
 * `MAX_PLAUSIBLE_MATCH_MINUTES` in `recoveryTimeline.ts` — the two surfaces should not disagree about
 * what is plausible.
 */
const MAX_PLAUSIBLE_MATCH_MINUTES = 12 * 60;

export type OfficialState = 'onCourt' | 'assigned' | 'waiting' | 'available';

export interface OfficialRow {
  participantId: string;
  participantName: string;
  state: OfficialState;
  /** Court of the in-progress or next assignment, when there is one. */
  courtName?: string;
  matchUpId?: string;
  /** `scheduledTime` of the next not-yet-started assignment on this date. */
  nextScheduledTime?: string;
  matchesToday: number;
  minutesOnCourtToday: number;
  /**
   * Carried through verbatim for the contact column and the call sheet (P1).
   *
   * **Not filtered here.** `contactFormatter` and `buildCallSheet` already own the D6 rule — every
   * contact is shown with a marker on the un-consented ones, and `isPublic` gates public surfaces
   * only. Filtering in this module would be a second gate on top of a decided one, and it would
   * silently disagree with the participants call sheet.
   */
  contacts?: any[];
  participantRole?: string;
}

/**
 * Minutes of play the factory has already measured for this matchUp.
 *
 * **Reads `schedule.milliseconds`, not `matchUpDuration`.** The board originally read a top-level
 * `matchUpDuration`, which is `undefined` on every hydration TMX uses — verified against
 * `allTournamentMatchUps({ inContext, nextMatchUps })`, `competitionScheduleMatchUps` and
 * `getMatchUpScheduleDetails` — so the column was always blank. The figure is published as
 * `schedule.milliseconds` (with a formatted `schedule.time` alongside).
 *
 * Consuming the integer is also the right call: parsing `"HH:MM:SS"` re-derived a number the factory
 * had already computed, and would silently yield 0 if that format ever changed.
 *
 * ⚠️ **Includes a live-elapsed term for a running matchUp**, so it grows between reads and an
 * unclosed timer would grow without bound — hence the cap at the call site.
 */
export function durationMinutes(matchUp: any): number {
  const milliseconds = matchUp?.schedule?.milliseconds;
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds) || milliseconds <= 0) return 0;
  return Math.floor(milliseconds / 60_000);
}

function isLive(matchUp: any): boolean {
  return matchUp?.matchUpStatus === IN_PROGRESS || matchUp?.matchUpStatus === SUSPENDED;
}

function isFinished(matchUp: any): boolean {
  return COMPLETED_STATUSES.has(matchUp?.matchUpStatus) || matchUp?.winningSide !== undefined;
}

/** Officials are identified by what they DO, never by participantType. */
export function isOfficial(participant: any): boolean {
  return participant?.participantRole === OFFICIAL;
}

export interface BoardArgs {
  matchUps: any[];
  participants: any[];
  /** The viewed date, `YYYY-MM-DD`. */
  date: string;
}

export function buildOfficialsBoard({ matchUps, participants, date }: BoardArgs): OfficialRow[] {
  const officials = (participants ?? []).filter(isOfficial);
  const onDate = (matchUps ?? []).filter((matchUp) => matchUp?.schedule?.scheduledDate === date);

  const rows = officials.map((participant: any) => {
    const assigned = onDate.filter((matchUp) => matchUp?.schedule?.official === participant.participantId);
    const live = assigned.find(isLive);
    const upcoming = assigned
      .filter((matchUp) => !isLive(matchUp) && !isFinished(matchUp))
      .toSorted((a, b) =>
        String(a?.schedule?.scheduledTime ?? '').localeCompare(String(b?.schedule?.scheduledTime ?? '')),
      );

    const current = live ?? upcoming[0];
    let state: OfficialState;
    if (live) state = 'onCourt';
    else if (upcoming.length) state = 'assigned';
    else if (signedInOnDate(participant, date)) state = 'waiting';
    else state = 'available';

    return {
      participantId: participant.participantId,
      participantName: participant.participantName ?? '',
      state,
      courtName: current?.schedule?.courtName,
      matchUpId: current?.matchUpId,
      nextScheduledTime: live ? undefined : upcoming[0]?.schedule?.scheduledTime,
      contacts: participant?.person?.contacts ?? [],
      participantRole: participant?.participantRole,
      matchesToday: assigned.length,
      minutesOnCourtToday: assigned.reduce(
        (total, matchUp) => total + Math.min(durationMinutes(matchUp), MAX_PLAUSIBLE_MATCH_MINUTES),
        0,
      ),
    };
  });

  // Pre-sorted before it reaches Tabulator (house rule): busiest states first, then by name.
  const ORDER: OfficialState[] = ['onCourt', 'assigned', 'waiting', 'available'];
  return rows.toSorted(
    (a, b) =>
      ORDER.indexOf(a.state) - ORDER.indexOf(b.state) ||
      a.participantName.localeCompare(b.participantName, undefined, { numeric: true }),
  );
}

// Re-exported so the officials surface has one import site; the implementation is shared with the
// participants presence surface so the two cannot drift into two presence models (D4e).
export { signedInOnDate, localCalendarDate };
