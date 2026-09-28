/**
 * The three decisions that used to be spread across four call sites as private copies.
 *
 * The defect these pin: the Issues count badge hardcoded a single alarming fill, so a
 * schedule carrying eighteen ordinary adjacency warnings was drawn exactly like one
 * carrying eighteen faults. The badge's colour is DOM and Journey 134 covers the
 * rendered article; what lives here is the rule it renders — which is the part that can
 * be exercised at all, since TMX runs vitest with no jsdom.
 *
 * Each block asserts BOTH directions. `badgeSeverity` returning `'ERROR'` for a set
 * containing one is only half a test: an implementation that answered `'ERROR'`
 * unconditionally — i.e. the bug — would pass it.
 */
import { badgeSeverity, decoratesCell, severityOf } from './scheduleIssueSeverity';
import { factoryConstants } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

// constants and types
import type { ScheduleIssue, ScheduleIssueSeverity } from 'courthive-components';

const { scheduleConstants } = factoryConstants;
const { SCHEDULE_ERROR, SCHEDULE_CONFLICT, SCHEDULE_WARNING, SCHEDULE_ISSUE } = scheduleConstants;

/** Only the field every rule under test reads. A wider stub would hide which one matters. */
const issue = (severity: ScheduleIssueSeverity): ScheduleIssue =>
  ({ severity, message: `${severity} issue` }) as ScheduleIssue;

describe('severityOf', () => {
  it('maps the factory vocabulary onto the three display severities', () => {
    expect(severityOf(SCHEDULE_ERROR)).toBe('ERROR');
    expect(severityOf(SCHEDULE_CONFLICT)).toBe('ERROR');
    expect(severityOf(SCHEDULE_WARNING)).toBe('WARN');
    expect(severityOf(SCHEDULE_ISSUE)).toBe('INFO');
  });

  it('reads the real constant values, not a re-spelling of them', () => {
    // The mapping is only correct if these are the strings proConflicts actually emits.
    // Hardcoding 'ERROR'/'WARNING' in the module and in the test would agree with itself
    // while disagreeing with the engine.
    expect([SCHEDULE_ERROR, SCHEDULE_CONFLICT, SCHEDULE_WARNING, SCHEDULE_ISSUE]).toStrictEqual([
      'ERROR',
      'CONFLICT',
      'WARNING',
      'ISSUE',
    ]);
  });

  it('degrades an unknown or absent issue to WARN rather than to either extreme', () => {
    // A vocabulary the factory adds later must not silently become an alarm, and must
    // not silently vanish from a grid the operator is reading for faults.
    expect(severityOf('SOMETHING_NEW')).toBe('WARN');
    expect(severityOf(undefined)).toBe('WARN');
  });
});

describe('badgeSeverity', () => {
  it('reads as an error when any issue is one', () => {
    expect(badgeSeverity([issue('WARN'), issue('ERROR'), issue('WARN')])).toBe('ERROR');
    expect(badgeSeverity([issue('ERROR')])).toBe('ERROR');
  });

  it('reads as a warning when none is — the defect, stated', () => {
    // CA's report: eighteen issues, every one a WARN, drawn in the error fill.
    expect(badgeSeverity(Array.from({ length: 18 }, () => issue('WARN')))).toBe('WARN');
  });

  it('does not escalate INFO, and does not report on an empty set', () => {
    expect(badgeSeverity([issue('INFO'), issue('WARN')])).toBe('WARN');
    expect(badgeSeverity([])).toBe('WARN');
  });
});

describe('decoratesCell', () => {
  it('decorates everything while the preference is on — today’s behaviour, unchanged', () => {
    for (const raw of [SCHEDULE_ERROR, SCHEDULE_CONFLICT, SCHEDULE_WARNING, SCHEDULE_ISSUE]) {
      expect(decoratesCell(raw, true)).toBe(true);
    }
  });

  it('withholds ONLY warnings once the preference is off', () => {
    expect(decoratesCell(SCHEDULE_WARNING, false)).toBe(false);
    // The errors the toggle exists to make visible are never withheld.
    expect(decoratesCell(SCHEDULE_ERROR, false)).toBe(true);
    expect(decoratesCell(SCHEDULE_CONFLICT, false)).toBe(true);
    // INFO is already quiet; a control labelled "warning bars" must not eat it.
    expect(decoratesCell(SCHEDULE_ISSUE, false)).toBe(true);
  });

  it('withholds an unrecognised issue too, because it is classified WARN', () => {
    // Stated so the coupling to `severityOf`'s fallback is deliberate rather than
    // incidental: change that default and this is the test that tells you.
    expect(decoratesCell('SOMETHING_NEW', false)).toBe(false);
    expect(decoratesCell('SOMETHING_NEW', true)).toBe(true);
  });
});
