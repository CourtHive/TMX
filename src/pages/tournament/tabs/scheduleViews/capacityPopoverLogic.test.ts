/**
 * Coverage for the popover's load-bearing helper: when an operator extends
 * one date's hours, we must REPLACE that date's entry in-place without
 * disturbing other dates and without dropping any bookings the painter
 * attached to that date entry (PRACTICE blocks, maintenance windows, etc.).
 *
 * See Mentat/planning/SCHEDULE2_AVAILABILITY_INTEGRATION.md row 3(b).
 */
import { describe, expect, it } from 'vitest';

import { updateCourtDateAvailability } from './capacityPopoverLogic';

const DATE_TARGET = '2026-06-08';
const DATE_OTHER = '2026-06-09';
const NEW_TIMES = { startTime: '07:00', endTime: '22:00' };
const NEW_ENTRY = { date: DATE_TARGET, ...NEW_TIMES };

describe('updateCourtDateAvailability', () => {
  it('replaces an existing entry for the target date in place', () => {
    const otherEntry = { date: DATE_OTHER, startTime: '09:00', endTime: '21:00' };
    const existing = [{ date: DATE_TARGET, startTime: '08:00', endTime: '20:00' }, otherEntry];
    const result = updateCourtDateAvailability(existing, NEW_ENTRY);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(NEW_ENTRY);
    expect(result[1]).toEqual(otherEntry);
  });

  it('appends a new entry when the target date has no existing override', () => {
    const existing = [{ date: DATE_OTHER, startTime: '09:00', endTime: '21:00' }];
    const result = updateCourtDateAvailability(existing, NEW_ENTRY);

    expect(result).toHaveLength(2);
    expect(result.find((e: any) => e.date === DATE_TARGET)).toEqual(NEW_ENTRY);
  });

  it('preserves bookings already on the target date entry', () => {
    // The painter attached a PRACTICE block to the target date; the popover
    // edit changes only the open window. Losing the booking would be a
    // silent data-loss regression — the popover would erase work the
    // painter did.
    const bookings = [{ startTime: '13:00', endTime: '15:00', bookingType: 'PRACTICE' }];
    const existing = [{ date: DATE_TARGET, startTime: '08:00', endTime: '20:00', bookings }];
    const result = updateCourtDateAvailability(existing, NEW_ENTRY);

    expect(result[0]).toEqual({ ...NEW_ENTRY, bookings });
  });

  it('returns a single-entry array when there is no existing dateAvailability at all', () => {
    const result = updateCourtDateAvailability(undefined, NEW_ENTRY);
    expect(result).toEqual([NEW_ENTRY]);
  });

  it('does not mutate the input array', () => {
    const existing = [{ date: DATE_TARGET, startTime: '08:00', endTime: '20:00' }];
    const snapshot = JSON.stringify(existing);
    updateCourtDateAvailability(existing, NEW_ENTRY);
    expect(JSON.stringify(existing)).toEqual(snapshot);
  });
});
