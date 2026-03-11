import { describe, expect, it } from 'vitest';
import { acceptedEntryStatuses } from './acceptedEntryStatuses';

describe('acceptedEntryStatuses', () => {
  it('returns 5 statuses for default MAIN stage', () => {
    const statuses = acceptedEntryStatuses();
    expect(statuses).toHaveLength(5);
    expect(statuses.every((s: string) => s.startsWith('MAIN.'))).toBe(true);
  });

  it('includes expected entry status types', () => {
    const statuses = acceptedEntryStatuses();
    expect(statuses).toContain('MAIN.DIRECT_ACCEPTANCE');
    expect(statuses).toContain('MAIN.ORGANISER_ACCEPTANCE');
    expect(statuses).toContain('MAIN.SPECIAL_EXEMPT');
    expect(statuses).toContain('MAIN.JUNIOR_EXEMPT');
    expect(statuses).toContain('MAIN.WILDCARD');
  });

  it('uses provided stage prefix', () => {
    const statuses = acceptedEntryStatuses('QUALIFYING');
    expect(statuses.every((s: string) => s.startsWith('QUALIFYING.'))).toBe(true);
    expect(statuses).toContain('QUALIFYING.DIRECT_ACCEPTANCE');
    expect(statuses).toContain('QUALIFYING.WILDCARD');
  });

  it('returns consistent count for any stage', () => {
    expect(acceptedEntryStatuses('CONSOLATION')).toHaveLength(5);
  });
});
