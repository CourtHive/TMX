/**
 * Call-to-court prompt gating: On / Off / Auto.
 *
 * The case that drove the whole design is `auto` + `0` checked in for this match while somebody
 * elsewhere HAS checked in today. The rule this replaced (`onlyWhenPartial`, #1349) was silent
 * there — and "nobody came" is the most alarming state a desk running check-in can be in.
 */
import { checkInInUse, shouldPromptOnCall, DEFAULT_CHECK_IN_PROMPT_MODE } from './checkInPromptMode';
import { describe, expect, it } from 'vitest';

const DAY = '2026-08-24';
const OTHER = '2026-08-25';

const matchUp = (checkedInParticipantIds: string[], scheduledDate = DAY) => ({
  checkedInParticipantIds,
  schedule: { scheduledDate },
});

describe('DEFAULT_CHECK_IN_PROMPT_MODE', () => {
  it('is off — the feature ships dark and is opted into', () => {
    expect(DEFAULT_CHECK_IN_PROMPT_MODE).toBe('off');
  });
});

describe('checkInInUse', () => {
  it('is false when nobody has checked in anywhere', () => {
    expect(checkInInUse([matchUp([]), matchUp([])], DAY)).toBe(false);
  });

  it('is true once anybody has checked in to any match that day', () => {
    // One check-in anywhere is the evidence that a desk is running check-in at all.
    expect(checkInInUse([matchUp([]), matchUp(['p1'])], DAY)).toBe(true);
  });

  it('ignores check-ins on a DIFFERENT date', () => {
    // Load-bearing: without the date filter, Monday's check-ins arm prompts all Tuesday.
    expect(checkInInUse([matchUp(['p1'], OTHER)], DAY)).toBe(false);
  });

  it('spans dates when no date is supplied', () => {
    expect(checkInInUse([matchUp(['p1'], OTHER)])).toBe(true);
  });

  it('is false for missing or empty input', () => {
    expect(checkInInUse(undefined, DAY)).toBe(false);
    expect(checkInInUse([], DAY)).toBe(false);
  });
});

describe('shouldPromptOnCall', () => {
  it('off never prompts, even when nobody has checked in', () => {
    expect(shouldPromptOnCall({ mode: 'off', inUse: true, awaitingCount: 4 })).toBe(false);
  });

  it('on always prompts when somebody is missing, in use or not', () => {
    expect(shouldPromptOnCall({ mode: 'on', inUse: false, awaitingCount: 1 })).toBe(true);
  });

  it('auto prompts at ZERO checked in when the desk is using check-in', () => {
    // THE case the tournament-scoped heuristic exists for, and the one `onlyWhenPartial` missed.
    expect(shouldPromptOnCall({ mode: 'auto', inUse: true, awaitingCount: 4 })).toBe(true);
  });

  it('auto stays silent at a tournament not using check-in', () => {
    // The 9am case, and the all-week case. This is what `onlyWhenPartial` got right and must survive.
    expect(shouldPromptOnCall({ mode: 'auto', inUse: false, awaitingCount: 4 })).toBe(false);
  });

  it('never prompts when everyone is already checked in, in any mode', () => {
    for (const mode of ['off', 'auto', 'on'] as const) {
      expect(shouldPromptOnCall({ mode, inUse: true, awaitingCount: 0 })).toBe(false);
    }
  });
});
