import { planGuardRefusalCount, profileRepairOffer, schedulerResultOf } from './schedulingRefusals';
import { describe, expect, it } from 'vitest';

const repairRefusal = {
  error: { code: 'ERR_SCHEDULING_PROFILE_REPAIR_REQUIRED', message: 'Scheduling profile needs repair' },
  context: { repairedSchedulingProfile: [{ scheduleDate: '2026-10-01', venues: [] }], modifications: 2, issues: ['x'] },
};

describe('profileRepairOffer', () => {
  it('reads the repaired profile a refusal offers', () => {
    expect(profileRepairOffer(repairRefusal)).toEqual({
      repairedSchedulingProfile: [{ scheduleDate: '2026-10-01', venues: [] }],
      modifications: 2,
      issues: ['x'],
    });
  });

  it('is undefined for any other result, or a refusal without a profile', () => {
    expect(profileRepairOffer({ success: true })).toBeUndefined();
    expect(profileRepairOffer({ error: { code: 'ANACHRONISM' } })).toBeUndefined();
    expect(profileRepairOffer({ error: repairRefusal.error })).toBeUndefined();
  });
});

describe('planGuardRefusalCount', () => {
  it('counts the placements the guard refused', () => {
    expect(planGuardRefusalCount({ error: { code: 'ANACHRONISM' }, context: { refusals: [{}, {}] } })).toEqual(2);
  });

  it('is undefined for a single write refusal (no list) and for other results', () => {
    expect(planGuardRefusalCount({ error: { code: 'ANACHRONISM' }, context: { blockingMatchUps: [{}] } })).toBe(
      undefined,
    );
    expect(planGuardRefusalCount(repairRefusal)).toBeUndefined();
  });
});

describe('schedulerResultOf', () => {
  it('takes the last result of a queue when it carries the error', () => {
    expect(schedulerResultOf({ results: [{ success: true }, repairRefusal] })).toBe(repairRefusal);
  });

  it('falls back to the queue result', () => {
    const eqResult = { error: { code: 'X' } };
    expect(schedulerResultOf(eqResult)).toBe(eqResult);
  });
});
