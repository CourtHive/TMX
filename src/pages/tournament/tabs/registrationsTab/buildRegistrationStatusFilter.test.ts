import { describe, expect, it } from 'vitest';

import { filterEntriesByValue, isOpenStatus } from './buildRegistrationStatusFilter';

const ENTRIES = [
  { registrationId: 'r-1', status: 'applied' as const },
  { registrationId: 'r-2', status: 'accepted' as const },
  { registrationId: 'r-3', status: 'waitlisted' as const },
  { registrationId: 'r-4', status: 'rejected' as const },
  { registrationId: 'r-5', status: 'applied' as const },
];

describe('filterEntriesByValue', () => {
  it('returns the full list for value "all"', () => {
    expect(filterEntriesByValue(ENTRIES, 'all')).toHaveLength(5);
  });

  it('returns applied + waitlisted rows for value "open"', () => {
    const open = filterEntriesByValue(ENTRIES, 'open');
    expect(open.map((e) => e.registrationId)).toEqual(['r-1', 'r-3', 'r-5']);
  });

  it('returns only matching status for a specific status value', () => {
    expect(filterEntriesByValue(ENTRIES, 'rejected')).toEqual([
      { registrationId: 'r-4', status: 'rejected' },
    ]);
    expect(filterEntriesByValue(ENTRIES, 'accepted').map((e) => e.registrationId)).toEqual(['r-2']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterEntriesByValue(ENTRIES, 'seeded')).toEqual([]);
  });
});

describe('isOpenStatus', () => {
  it('treats applied + waitlisted as open', () => {
    expect(isOpenStatus('applied')).toBe(true);
    expect(isOpenStatus('waitlisted')).toBe(true);
  });

  it('treats every other status as closed', () => {
    expect(isOpenStatus('accepted')).toBe(false);
    expect(isOpenStatus('seeded')).toBe(false);
    expect(isOpenStatus('rejected')).toBe(false);
    expect(isOpenStatus('withdrawn')).toBe(false);
  });
});
