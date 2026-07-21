import { describe, it, expect } from 'vitest';

import { collapseRegistrationPairs } from './collapseRegistrationPairs';

const entry = (id: string, overrides: any = {}): any => ({
  registrationId: id,
  status: 'applied',
  partnerInviteId: null,
  eventIds: ['e-1'],
  applicantGivenName: id,
  applicantFamilyName: 'X',
  ...overrides,
});

describe('collapseRegistrationPairs', () => {
  it('leaves individuals (no partnerInviteId) as individual rows', () => {
    const rows = collapseRegistrationPairs([entry('a'), entry('b')]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === 'individual')).toBe(true);
  });

  it('collapses a complete pair (both halves, same invite, non-terminal) into ONE row', () => {
    const rows = collapseRegistrationPairs([
      entry('a', { partnerInviteId: 'inv-1' }),
      entry('b', { partnerInviteId: 'inv-1' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('pair');
    expect(rows[0].registrationIds).toEqual(['a', 'b']);
  });

  it('keeps a pending pair (only one side registered) as an individual — no partial pair row', () => {
    const rows = collapseRegistrationPairs([entry('a', { partnerInviteId: 'inv-1' })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('individual');
  });

  it('does not pair terminal entries (withdrawn/rejected)', () => {
    const rows = collapseRegistrationPairs([
      entry('a', { partnerInviteId: 'inv-1', status: 'withdrawn' }),
      entry('b', { partnerInviteId: 'inv-1' }),
    ]);
    // a is terminal → individual; b is a lone non-terminal half → individual (no pair)
    expect(rows.every((r) => r.kind === 'individual')).toBe(true);
  });

  it('preserves order (pair row at the first half position) and handles a mixed list', () => {
    const rows = collapseRegistrationPairs([
      entry('solo1'),
      entry('a', { partnerInviteId: 'inv-1' }),
      entry('solo2'),
      entry('b', { partnerInviteId: 'inv-1' }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(['individual', 'pair', 'individual']);
    expect(rows[1].registrationIds).toEqual(['a', 'b']);
  });
});
