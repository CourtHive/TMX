import { checkInDeskMatchUps, type DeskFilters } from './checkInDeskModel';
import { doublesMatchUp } from './checkInTestMatchUps';
import { checkOutLocked } from './checkInEligibility';
import { describe, expect, it } from 'vitest';

const DATE = '2026-11-09';
const filters: DeskFilters = { search: '', status: 'all', eventId: '', venueId: '', showCompleted: false };
const matchUp = (id: string, checked: string[] = [], schedule: any = {}) => ({
  ...doublesMatchUp(checked),
  matchUpId: id,
  eventId: 'event',
  matchUpStatus: 'TO_BE_PLAYED',
  schedule: { scheduledDate: DATE, venueId: 'venue', ...schedule },
});

describe('check-in desk selection', () => {
  it('includes zero and partial presence, excludes other dates and empty draws', () => {
    const source = [
      matchUp('zero'),
      matchUp('partial', ['p1']),
      matchUp('tomorrow', [], { scheduledDate: '2026-11-10' }),
      { ...matchUp('empty'), sides: [] },
    ];
    expect(checkInDeskMatchUps(source, DATE, filters).map((m) => m.matchUpId)).toEqual(['partial', 'zero']);
  });
  it('searches individuals in doubles, rather than the pair name', () => {
    expect(checkInDeskMatchUps([matchUp('doubles')], DATE, { ...filters, search: 'nkemelu' })).toHaveLength(1);
    expect(checkInDeskMatchUps([matchUp('doubles')], DATE, { ...filters, search: 'absent person' })).toHaveLength(0);
  });
  it('filters partial, complete and awaiting independently', () => {
    const source = [matchUp('zero'), matchUp('partial', ['p1']), matchUp('complete', ['p1', 'p2', 'p3', 'p4'])];
    expect(checkInDeskMatchUps(source, DATE, { ...filters, status: 'partial' }).map((m) => m.matchUpId)).toEqual([
      'partial',
    ]);
    expect(checkInDeskMatchUps(source, DATE, { ...filters, status: 'complete' }).map((m) => m.matchUpId)).toEqual([
      'complete',
    ]);
    expect(checkInDeskMatchUps(source, DATE, { ...filters, status: 'awaiting' })).toHaveLength(2);
  });
  it('filters events and venues, and hides completed matches by default', () => {
    const finished = { ...matchUp('finished'), matchUpStatus: 'COMPLETED' };
    expect(checkInDeskMatchUps([finished], DATE, filters)).toHaveLength(0);
    expect(checkInDeskMatchUps([finished], DATE, { ...filters, showCompleted: true })).toHaveLength(1);
    expect(checkInDeskMatchUps([matchUp('other')], DATE, { ...filters, eventId: 'other' })).toHaveLength(0);
    expect(checkInDeskMatchUps([matchUp('other')], DATE, { ...filters, venueId: 'other' })).toHaveLength(0);
  });
  it('orders times, courts naturally, then untimed matches without changing the source', () => {
    const source = [
      matchUp('untimed'),
      matchUp('court10', [], { scheduledTime: '09:00', courtName: 'Court 10' }),
      matchUp('court2', [], { scheduledTime: '09:00', courtName: 'Court 2' }),
      matchUp('later', [], { scheduledTime: '10:00' }),
    ];
    expect(checkInDeskMatchUps(source, DATE, filters).map((m) => m.matchUpId)).toEqual([
      'court2',
      'court10',
      'later',
      'untimed',
    ]);
    expect(source[0].matchUpId).toEqual('untimed');
  });
});

describe('check-out play restrictions', () => {
  it('allows correction before play and prevents it after play starts or a score exists', () => {
    expect(checkOutLocked(matchUp('pending'))).toBe(false);
    expect(checkOutLocked({ ...matchUp('live'), matchUpStatus: 'IN_PROGRESS' })).toBe(true);
    expect(checkOutLocked({ ...matchUp('complete'), matchUpStatus: 'COMPLETED' })).toBe(true);
    expect(checkOutLocked({ ...matchUp('score'), score: { sets: [{ side1Score: 1, side2Score: 0 }] } })).toBe(true);
  });
});
