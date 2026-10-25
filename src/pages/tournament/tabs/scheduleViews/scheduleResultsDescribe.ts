/**
 * Pure formatting helpers for the schedule2 results drawer. Extracted from
 * `scheduleResultsDrawer.ts` so the rendering text can be unit-tested without
 * pulling in the modal stack (and `document`-touching component imports).
 */

export type ParticipantLookup = Map<string, string>;

export type MatchUpLookupEntry = {
  matchUpId: string;
  drawId?: string;
  eventId?: string;
  drawName?: string;
  eventName?: string;
  roundLabel?: string;
  participantsLabel: string;
  matchUpType?: string;
};

export type MatchUpLookup = Map<string, MatchUpLookupEntry>;

export interface OverLimitAttempt {
  matchUpId: string;
  attemptedTime?: string;
  participants: {
    participantId: string;
    atLimitCounters: { counter: string; count: number; limit: number }[];
  }[];
}

// "Amelie Paz @ SINGLES (2 of 2), Aravis Ellul @ total (3 of 3) — tried 12:30, 13:00"
export function describeOverLimitAttempts(attempts: OverLimitAttempt[], participants: ParticipantLookup): string {
  if (!attempts.length) return '';

  // Dedupe (participantId + counter) across all attempts — same person at
  // same counter on multiple attempts is the same blocker.
  const seen = new Set<string>();
  const fragments: string[] = [];
  for (const attempt of attempts) {
    for (const p of attempt.participants ?? []) {
      for (const c of p.atLimitCounters ?? []) {
        const key = `${p.participantId}::${c.counter}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const name = participants.get(p.participantId) ?? p.participantId;
        fragments.push(`${name} @ ${c.counter} (${c.count} of ${c.limit})`);
      }
    }
  }

  const times = uniqueAttemptedTimes(attempts);
  const timesFragment = times.length ? ` — tried ${times.join(', ')}` : '';
  return fragments.length ? `${fragments.join(', ')}${timesFragment}` : timesFragment.replace(/^ — /, '');
}

export function uniqueAttemptedTimes(attempts: OverLimitAttempt[]): string[] {
  const set = new Set<string>();
  for (const a of attempts) if (a.attemptedTime) set.add(a.attemptedTime);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function describeRecoveryDeferred(
  attempts: { scheduleTime: string; blockingParticipantIds?: string[]; notBeforeTime?: string }[],
  participants: ParticipantLookup,
): string {
  if (!attempts.length) return '';
  const blockerNames = new Set<string>();
  const notBefore = new Set<string>();
  for (const attempt of attempts) {
    for (const pid of attempt.blockingParticipantIds ?? []) {
      blockerNames.add(participants.get(pid) ?? pid);
    }
    if (attempt.notBeforeTime) notBefore.add(attempt.notBeforeTime);
  }
  const times = attempts.map((a) => a.scheduleTime).filter(Boolean);
  const fragments: string[] = [];
  if (blockerNames.size) fragments.push(`${[...blockerNames].join(', ')} need recovery time`);
  if (notBefore.size) fragments.push(`not before ${[...notBefore].sort((a, b) => a.localeCompare(b)).join(', ')}`);
  if (times.length) fragments.push(`tried ${times.join(', ')}`);
  return fragments.join(' — ');
}

export function describeDependencyDeferred(
  attempts: { scheduleTime: string; remainingDependencies?: string[] }[],
  matchUps: MatchUpLookup,
): string {
  if (!attempts.length) return '';
  const blockerLabels = new Set<string>();
  for (const attempt of attempts) {
    for (const depId of attempt.remainingDependencies ?? []) {
      const info = matchUps.get(depId);
      const label = info ? `${info.roundLabel || ''} ${info.participantsLabel}`.trim() : depId;
      blockerLabels.add(label);
    }
  }
  const times = attempts.map((a) => a.scheduleTime).filter(Boolean);
  const fragments: string[] = [];
  if (blockerLabels.size) fragments.push(`waiting on ${[...blockerLabels].join(', ')}`);
  if (times.length) fragments.push(`tried ${times.join(', ')}`);
  return fragments.join(' — ');
}

export type PlayedOrderDeferral = {
  scheduleTime?: string;
  blockingMatchUps?: { matchUpId: string; scheduledDate?: string; scheduledTime?: string; roundNumber?: number }[];
};

// "R1 · Amelie Paz vs Aravis Ellul already played 2026-10-02 09:00 (+1 more) — tried 08:00"
export function describePlayedOrderDeferred(
  deferral: PlayedOrderDeferral | undefined,
  matchUps: MatchUpLookup,
  phrase: (params: { matchUp: string; when: string }) => string,
): string {
  const [first, ...rest] = deferral?.blockingMatchUps ?? [];
  if (!first) return deferral?.scheduleTime ? `tried ${deferral.scheduleTime}` : '';
  const entry = matchUps.get(first.matchUpId);
  const matchUp = entry
    ? [entry.roundLabel, entry.participantsLabel].filter(Boolean).join(' · ')
    : `R${first.roundNumber ?? '?'}`;
  const when = [first.scheduledDate, first.scheduledTime].filter(Boolean).join(' ');
  const more = rest.length ? ` (+${rest.length} more)` : '';
  const tried = deferral?.scheduleTime ? ` — tried ${deferral.scheduleTime}` : '';
  return `${phrase({ matchUp, when })}${more}${tried}`;
}

/** a participant short of the policy's overnight rest before a matchUp (the factory warns, it does not hold) */
export type OvernightRestWarning = {
  /** absent when the player is not yet known: whoever advances from `previousMatchUpId` */
  participantId?: string;
  matchUpId: string;
  scheduleTime: string;
  previousMatchUpId: string;
  previousEndTime: string;
  restMinutes: number;
  requiredMinutes: number;
};

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** the warnings of one date, one entry per matchUp warned, in the order of their start */
export function groupOvernightRest(warnings: OvernightRestWarning[]): [string, OvernightRestWarning[]][] {
  const byMatchUp = new Map<string, OvernightRestWarning[]>();
  for (const warning of warnings) {
    const group = byMatchUp.get(warning.matchUpId) ?? [];
    group.push(warning);
    byMatchUp.set(warning.matchUpId, group);
  }
  return [...byMatchUp.entries()].sort(([, [a]], [, [b]]) => a.scheduleTime.localeCompare(b.scheduleTime));
}

// "Amelie Paz rested 9h 30m after 22:30 (12h asked); the player advancing from R1 · A / B rested …"
export function describeOvernightRest(
  warnings: OvernightRestWarning[],
  lookups: { participants: ParticipantLookup; matchUps: MatchUpLookup },
  phrase: (params: { who: string; rest: string; end: string; required: string }) => string,
  advancing: (params: { matchUp: string }) => string,
): string {
  return warnings
    .map((warning) => {
      const who = warning.participantId
        ? (lookups.participants.get(warning.participantId) ?? warning.participantId)
        : advancing({ matchUp: matchUpLabel(warning.previousMatchUpId, lookups.matchUps) });
      return phrase({
        required: formatMinutes(warning.requiredMinutes),
        rest: formatMinutes(warning.restMinutes),
        end: warning.previousEndTime,
        who,
      });
    })
    .join('; ');
}

function matchUpLabel(matchUpId: string, matchUps: MatchUpLookup): string {
  const entry = matchUps.get(matchUpId);
  return entry ? [entry.roundLabel, entry.participantsLabel].filter(Boolean).join(' · ') : matchUpId;
}

/**
 * One row per matchUp a conflict refused. The factory reports a date's conflicts as one entry per person request a
 * placement broke, `{ request, scheduleTimes, matchUpIds }`; releases before that reported `{ matchUpId, scheduleTime,
 * requestType }` per refusal, which is still read.
 */
export function conflictRows(conflict: any): { matchUpId?: string; detail: string }[] {
  if (!Array.isArray(conflict?.matchUpIds))
    return [{ matchUpId: conflict?.matchUpId, detail: describeConflict(conflict) }];
  const { request = {}, scheduleTimes = [] } = conflict;
  const window = request.startTime && request.endTime ? `${request.startTime}–${request.endTime}` : '';
  const refused = scheduleTimes.length ? `@ ${scheduleTimes.join(', ')}` : '';
  const detail = [request.requestType, window, refused].filter(Boolean).join(' ');
  return conflict.matchUpIds.map((matchUpId: string) => ({ matchUpId, detail }));
}

export function describeConflict(conflict: any): string {
  if (!conflict) return '';
  const reason = conflict.reason || conflict.type || conflict.requestType;
  const time = conflict.scheduleTime ? `@ ${conflict.scheduleTime}` : '';
  const participant = conflict.participantName ? `(${conflict.participantName})` : '';
  return [reason, time, participant].filter(Boolean).join(' ');
}
