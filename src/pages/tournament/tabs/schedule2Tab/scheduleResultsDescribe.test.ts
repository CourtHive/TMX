import { describe, expect, it } from 'vitest';
import { describeRecoveryDeferred, describeDependencyDeferred } from './scheduleResultsDescribe';

const SMITH_VS_JONES = 'Smith vs Jones';

const participantLookup = (entries: [string, string][]) => new Map<string, string>(entries);

const matchUpLookup = (
  entries: [string, { matchUpId: string; roundLabel?: string; participantsLabel: string }][],
) => new Map<string, any>(entries);

describe('describeRecoveryDeferred', () => {
  it('returns empty string when there are no attempts', () => {
    expect(describeRecoveryDeferred([], participantLookup([]))).toBe('');
  });

  it('renders a single blocker with notBefore and attempted time', () => {
    const attempts = [
      { scheduleTime: '12:30', blockingParticipantIds: ['p1'], notBeforeTime: '13:30' },
    ];
    const lookup = participantLookup([['p1', 'Smith']]);
    expect(describeRecoveryDeferred(attempts, lookup)).toBe(
      'Smith need recovery time — not before 13:30 — tried 12:30',
    );
  });

  it('dedupes blockers across attempts and merges notBefore values in sort order', () => {
    const attempts = [
      { scheduleTime: '12:30', blockingParticipantIds: ['p1', 'p2'], notBeforeTime: '13:30' },
      { scheduleTime: '13:00', blockingParticipantIds: ['p1'], notBeforeTime: '13:00' },
    ];
    const lookup = participantLookup([
      ['p1', 'Smith'],
      ['p2', 'Jones'],
    ]);
    expect(describeRecoveryDeferred(attempts, lookup)).toBe(
      'Smith, Jones need recovery time — not before 13:00, 13:30 — tried 12:30, 13:00',
    );
  });

  it('falls back to the raw participantId when no name is resolved', () => {
    const attempts = [{ scheduleTime: '09:00', blockingParticipantIds: ['p-unknown'] }];
    expect(describeRecoveryDeferred(attempts, participantLookup([]))).toBe(
      'p-unknown need recovery time — tried 09:00',
    );
  });

  it('renders the times fragment alone when no blockers are present', () => {
    const attempts = [{ scheduleTime: '10:00' }, { scheduleTime: '10:30' }];
    expect(describeRecoveryDeferred(attempts, participantLookup([]))).toBe(
      'tried 10:00, 10:30',
    );
  });
});

describe('describeDependencyDeferred', () => {
  it('returns empty string when there are no attempts', () => {
    expect(describeDependencyDeferred([], matchUpLookup([]))).toBe('');
  });

  it('renders a resolved dependency with round label, participants, and attempted time', () => {
    const attempts = [{ scheduleTime: '12:30', remainingDependencies: ['m1'] }];
    const lookup = matchUpLookup([
      ['m1', { matchUpId: 'm1', roundLabel: 'R2', participantsLabel: SMITH_VS_JONES }],
    ]);
    expect(describeDependencyDeferred(attempts, lookup)).toBe(
      'waiting on R2 Smith vs Jones — tried 12:30',
    );
  });

  it('dedupes dependency labels across multiple attempts', () => {
    const attempts = [
      { scheduleTime: '12:30', remainingDependencies: ['m1', 'm2'] },
      { scheduleTime: '13:00', remainingDependencies: ['m1'] },
    ];
    const lookup = matchUpLookup([
      ['m1', { matchUpId: 'm1', roundLabel: 'R2', participantsLabel: SMITH_VS_JONES }],
      ['m2', { matchUpId: 'm2', roundLabel: 'R2', participantsLabel: 'Brown vs Davis' }],
    ]);
    expect(describeDependencyDeferred(attempts, lookup)).toBe(
      'waiting on R2 Smith vs Jones, R2 Brown vs Davis — tried 12:30, 13:00',
    );
  });

  it('falls back to the raw matchUpId when the dependency is not in the lookup', () => {
    const attempts = [{ scheduleTime: '09:00', remainingDependencies: ['m-unknown'] }];
    expect(describeDependencyDeferred(attempts, matchUpLookup([]))).toBe(
      'waiting on m-unknown — tried 09:00',
    );
  });

  it('renders the participants label alone when roundLabel is missing', () => {
    const attempts = [{ scheduleTime: '14:00', remainingDependencies: ['m1'] }];
    const lookup = matchUpLookup([
      ['m1', { matchUpId: 'm1', participantsLabel: SMITH_VS_JONES }],
    ]);
    expect(describeDependencyDeferred(attempts, lookup)).toBe(
      'waiting on Smith vs Jones — tried 14:00',
    );
  });

  it('omits the waiting fragment when there are no remaining dependencies', () => {
    const attempts = [{ scheduleTime: '10:00' }, { scheduleTime: '10:30' }];
    expect(describeDependencyDeferred(attempts, matchUpLookup([]))).toBe(
      'tried 10:00, 10:30',
    );
  });
});
