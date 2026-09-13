import { scheduledTimeModel, statusFor } from './scheduledTimeStatus';
import { describe, expect, it } from 'vitest';

// constants and types
import type { ReadinessFinding, ReadinessResult } from './matchUpReadiness';

function finding(overrides: Partial<ReadinessFinding>): ReadinessFinding {
  return {
    kind: 'recovery',
    severity: 'WARN',
    participantNames: ['Alice'],
    matchUpLabels: ['Quarterfinal: Alice vs Bob'],
    ...overrides,
  } as ReadinessFinding;
}

const evaluated = (findings: ReadinessFinding[]): ReadinessResult => ({ evaluated: true, findings });

describe('statusFor — severity follows the kind of blocker', () => {
  it('is ok with no findings at all', () => {
    expect(statusFor([])).toBe('ok');
  });

  it('is alert when a participant is on court elsewhere', () => {
    expect(statusFor([finding({ kind: 'overlap' })])).toBe('alert');
  });

  it('is alert when an upstream feeder finishes after the start', () => {
    expect(statusFor([finding({ kind: 'dependency', notBefore: '15:30' })])).toBe('alert');
  });

  it('is alert when an upstream feeder is not scheduled at all (no notBefore to project)', () => {
    expect(statusFor([finding({ kind: 'dependency' })])).toBe('alert');
  });

  it('is warn when the only blocker is a recovery window', () => {
    expect(statusFor([finding({ kind: 'recovery', notBefore: '14:45' })])).toBe('warn');
  });

  it('takes the worst tier when both are present', () => {
    expect(statusFor([finding({ kind: 'recovery' }), finding({ kind: 'dependency' })])).toBe('alert');
  });

  it('stays ok for an INFO-only result — undetermined sides whose upstream still finishes in time', () => {
    expect(statusFor([finding({ kind: 'undetermined', severity: 'INFO' })])).toBe('ok');
  });

  it('ignores an INFO finding riding alongside a WARN when deciding the tier', () => {
    // The real shape of the case that prompted the feature: a `dependency` WARN
    // and an `undetermined` INFO naming the same upstream.
    const findings = [
      finding({ kind: 'dependency', notBefore: '15:30' }),
      finding({ kind: 'undetermined', severity: 'INFO' }),
    ];
    expect(statusFor(findings)).toBe('alert');
  });
});

describe('scheduledTimeModel', () => {
  it('returns null when readiness could not be evaluated — an ungraded time is not a green one', () => {
    expect(scheduledTimeModel({ evaluated: false, reason: 'noTime' })).toBeNull();
    expect(scheduledTimeModel({ evaluated: false, reason: 'completed' })).toBeNull();
  });

  it('titles every finding, not only the one that set the tier', () => {
    const model = scheduledTimeModel(
      evaluated([
        finding({ kind: 'dependency', notBefore: '15:30' }),
        finding({ kind: 'undetermined', severity: 'INFO' }),
      ]),
    );
    expect(model?.status).toBe('alert');
    const lines = model?.title.split('\n') ?? [];
    // Heading + one line per finding.
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('15:30');
    expect(lines[2]).toContain('Quarterfinal: Alice vs Bob');
  });

  it('carries a heading even when nothing is wrong, so a green time can still be interrogated', () => {
    const model = scheduledTimeModel(evaluated([]));
    expect(model?.status).toBe('ok');
    expect(model?.title.length).toBeGreaterThan(0);
    expect(model?.title).not.toContain('\n');
  });
});
