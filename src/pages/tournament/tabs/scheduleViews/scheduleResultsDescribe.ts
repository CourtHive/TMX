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
