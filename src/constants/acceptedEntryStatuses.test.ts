import { acceptedEntryStatuses, acceptedStatusSet } from './acceptedEntryStatuses';
import { describe, expect, it } from 'vitest';

describe('acceptedEntryStatuses', () => {
  it('returns 8 statuses matching factory STRUCTURE_SELECTED_STATUSES', () => {
    const statuses = acceptedEntryStatuses();
    expect(statuses).toHaveLength(8);
    expect(statuses.every((s: string) => s.startsWith('MAIN.'))).toBe(true);
  });

  it('includes all STRUCTURE_SELECTED_STATUSES members', () => {
    const statuses = acceptedEntryStatuses();
    expect(statuses).toContain('MAIN.CONFIRMED');
    expect(statuses).toContain('MAIN.DIRECT_ACCEPTANCE');
    expect(statuses).toContain('MAIN.JUNIOR_EXEMPT');
    expect(statuses).toContain('MAIN.LUCKY_LOSER');
    expect(statuses).toContain('MAIN.QUALIFIER');
    expect(statuses).toContain('MAIN.ORGANISER_ACCEPTANCE');
    expect(statuses).toContain('MAIN.SPECIAL_EXEMPT');
    expect(statuses).toContain('MAIN.WILDCARD');
  });

  it('excludes non-structure statuses', () => {
    const statuses = acceptedEntryStatuses();
    expect(statuses).not.toContain('MAIN.ALTERNATE');
    expect(statuses).not.toContain('MAIN.WITHDRAWN');
    expect(statuses).not.toContain('MAIN.REGISTERED');
  });

  it('uses provided stage prefix', () => {
    const statuses = acceptedEntryStatuses('QUALIFYING');
    expect(statuses.every((s: string) => s.startsWith('QUALIFYING.'))).toBe(true);
    expect(statuses).toContain('QUALIFYING.DIRECT_ACCEPTANCE');
    expect(statuses).toContain('QUALIFYING.WILDCARD');
  });

  it('returns consistent count for any stage', () => {
    expect(acceptedEntryStatuses('CONSOLATION')).toHaveLength(8);
  });
});

describe('acceptedStatusSet', () => {
  it('is the shared set of the 8 unprefixed structure-selected statuses', () => {
    expect(acceptedStatusSet.size).toBe(8);
    for (const status of [
      'CONFIRMED',
      'DIRECT_ACCEPTANCE',
      'JUNIOR_EXEMPT',
      'LUCKY_LOSER',
      'QUALIFIER',
      'ORGANISER_ACCEPTANCE',
      'SPECIAL_EXEMPT',
      'WILDCARD',
    ]) {
      expect(acceptedStatusSet.has(status)).toBe(true);
    }
  });

  it('excludes non-accepted statuses', () => {
    expect(acceptedStatusSet.has('ALTERNATE')).toBe(false);
    expect(acceptedStatusSet.has('WITHDRAWN')).toBe(false);
    expect(acceptedStatusSet.has('REGISTERED')).toBe(false);
  });
});
