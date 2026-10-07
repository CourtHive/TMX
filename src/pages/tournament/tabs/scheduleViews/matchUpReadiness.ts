/**
 * Schedule2 — the readiness vocabulary TMX renders against.
 *
 * Readiness itself is the factory's `getMatchUpReadiness` (scheduleGovernor), called from
 * `inspectorReadiness.ts`. TMX carried its own copy of the analysis until 2026-10-07; the copy and
 * the query drifted (the dependency `readyAt`, doubles member names, two direction bugs in the clash
 * findings), so the copy is gone and only what TMX renders with remains here:
 *
 *   - the structural matchUp shape the schedule surfaces pass around (`ReadinessMatchUp`), which
 *     factory `inContext` output satisfies;
 *   - the payload types, re-exported from the factory so nothing here can disagree with them;
 *   - three small display helpers that are not part of the factory's package surface.
 *
 * Vocabulary deliberately matches `scheduleResultsDescribe.ts` ("needs recovery time", "not before
 * HH:MM", "waiting on …") so the same condition does not read two different ways on the same page.
 */

// constants and types
export type {
  ReadinessFinding,
  ReadinessKind,
  ReadinessResult,
  ReadinessSeverity,
  ReadinessSkipReason,
} from 'tods-competition-factory';
import type { ReadinessFinding } from 'tods-competition-factory';

/** The shape readiness needs off a hydrated matchUp. Structural, so the caller can pass factory output directly. */
export interface ReadinessMatchUp {
  matchUpId: string;
  matchUpStatus?: string;
  matchUpFormat?: string;
  matchUpType?: string;
  eventId?: string;
  roundName?: string;
  roundNumber?: number;
  winningSide?: number;
  winnerMatchUpId?: string;
  loserMatchUpId?: string;
  sides?: ReadinessSide[];
  schedule?: ReadinessSchedule | null;
  /**
   * Present once any score has been entered. Rest reads only whether it is
   * populated: a DEFAULTED matchUp carrying sets was played and then defaulted,
   * while a DEFAULTED matchUp with no score is a no-show who never took court.
   */
  score?: { sets?: unknown[]; scoreStringSide1?: string } | null;
}

export interface ReadinessSide {
  participantId?: string;
  participantName?: string;
  participant?: {
    participantId?: string;
    participantName?: string;
    individualParticipantIds?: string[];
    /**
     * Hydrated members of a pair or team, present on `inContext` matchUps.
     * `individualParticipantIds` carries the same identities without names, so
     * anything that must *show* a person reads this and anything that only needs
     * to compare identities reads the ids.
     */
    individualParticipants?: { participantId?: string; participantName?: string }[];
  };
}

export interface ReadinessSchedule {
  scheduledDate?: string;
  scheduledTime?: string;
  courtId?: string;
  /** Bare `HH:MM`, venue-local. Written only by an explicit operator action. */
  endTime?: string;
  /** Sparse: the calendar day the END_TIME fell on when the match crossed midnight. */
  endDate?: string;
  /** Bare `HH:MM`, venue-local. Written by start-on-drop and the manual start action. */
  startTime?: string;
  /** Full ISO instant, UTC. Stamped when the matchUp is called to court. */
  calledAt?: string;
  /** Full ISO instant, UTC. Auto-captured by the factory on first meaningful score. */
  scoredTime?: string;
  /**
   * Annotations qualifying `scheduledTime` — see `commitmentOf`. The factory
   * suppresses these at hydration once the matchUp has begun, so one arriving
   * here describes a matchUp that has not started.
   */
  timeModifiers?: string[];
}

/**
 * The earliest clock time this matchUp could sensibly start, given its findings.
 *
 * Takes the LATEST floor across them, not the earliest: each finding is a
 * separate thing standing in the way, and clearing one while another still
 * stands is not a start time.
 *
 * Prefers `readyAt` over `notBefore` wherever a finding carries both. A
 * dependency's `notBefore` is when the upstream match frees the COURT; its
 * `readyAt` is when the winner could actually be on it. Anything seeding a
 * clock — the Inspector's time picker does — wants the second, or it offers the
 * operator a time the panel beside it says the player cannot make.
 *
 * `HH:MM` is lexicographically ordered, so a string comparison is the clock one.
 */
export function earliestStart(findings: ReadinessFinding[]): string | undefined {
  const times = findings.map((finding) => finding.readyAt ?? finding.notBefore).filter(Boolean) as string[];
  return times.length ? times.toSorted((a, b) => a.localeCompare(b)).at(-1) : undefined;
}

const COMPLETED_STATUSES = new Set([
  'COMPLETED',
  'RETIRED',
  'WALKOVER',
  'DEFAULTED',
  'DOUBLE_WALKOVER',
  'DOUBLE_DEFAULT',
  'ABANDONED',
]);

/** True when a matchUp has a result and can no longer block anything. */
export function isFinished(matchUp: ReadinessMatchUp): boolean {
  return !!matchUp.winningSide || (!!matchUp.matchUpStatus && COMPLETED_STATUSES.has(matchUp.matchUpStatus));
}

function sideLabel(side: ReadinessSide): string {
  return side.participant?.participantName ?? side.participantName ?? 'TBD';
}

/** "R16: Alice vs Bob" — the label vocabulary the issues panel already uses. */
export function matchUpLabel(matchUp: ReadinessMatchUp): string {
  const names = (matchUp.sides ?? []).map(sideLabel);
  const players = names.length ? names.join(' vs ') : 'TBD vs TBD';
  return matchUp.roundName ? `${matchUp.roundName}: ${players}` : players;
}
