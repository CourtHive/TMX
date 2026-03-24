import { describe, expect, it, vi } from 'vitest';

vi.mock('components/modals/timePicker', () => ({ timePicker: vi.fn() }));
vi.mock('components/forms/venue', () => ({ toDisplayTime: (v: string) => v }));
vi.mock('tods-competition-factory', () => ({ tools: { dateTime: { convertTime: (v: string) => v } } }));
vi.mock('i18n', () => ({ t: (k: string) => k }));

import { militaryToMinutes } from './venueTimeHelpers';

describe('militaryToMinutes', () => {
  it('converts midnight', () => {
    expect(militaryToMinutes('00:00')).toBe(0);
  });

  it('converts noon', () => {
    expect(militaryToMinutes('12:00')).toBe(720);
  });

  it('converts end of day', () => {
    expect(militaryToMinutes('23:59')).toBe(1439);
  });

  it('converts morning time', () => {
    expect(militaryToMinutes('08:30')).toBe(510);
  });

  it('handles missing minutes', () => {
    expect(militaryToMinutes('14')).toBe(840);
  });
});
