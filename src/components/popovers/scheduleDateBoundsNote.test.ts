import { dateBoundsNotes } from './scheduleDateBoundsNote';
import { describe, expect, it } from 'vitest';

const [SAT, SUN, MON, TUE] = ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24'];
const NOT_AFTER = 'schedule.dateBounds.notAfter';
const NOT_BEFORE = 'schedule.dateBounds.notBefore';
const DATES = [SAT, SUN, MON, TUE];

describe('dateBoundsNotes', () => {
  it('names the earliest dependent on the day that ends the range', () => {
    const notes = dateBoundsNotes({
      latestDate: SAT,
      orderedBy: [
        { relation: 'dependent', matchUpId: 'late', scheduledDate: SAT, scheduledTime: '16:00' },
        { relation: 'dependent', matchUpId: 'r32', scheduledDate: SAT, scheduledTime: '14:30' },
        { relation: 'dependent', matchUpId: 'later-day', scheduledDate: MON },
      ],
      dates: DATES,
    });
    expect(notes).toEqual([{ key: NOT_AFTER, date: SAT, matchUpId: 'r32', scheduledTime: '14:30' }]);
  });

  it('names the latest source on the day that starts the range', () => {
    const notes = dateBoundsNotes({
      earliestDate: MON,
      orderedBy: [
        { relation: 'source', matchUpId: 'early', scheduledDate: MON, scheduledTime: '09:00' },
        { relation: 'source', matchUpId: 'qf', scheduledDate: MON, scheduledTime: '12:00' },
      ],
      dates: DATES,
    });
    expect(notes).toEqual([{ key: NOT_BEFORE, date: MON, matchUpId: 'qf', scheduledTime: '12:00' }]);
  });

  it('says nothing when the bounds are the tournament range itself', () => {
    expect(
      dateBoundsNotes({
        earliestDate: SAT,
        latestDate: TUE,
        orderedBy: [{ relation: 'dependent', matchUpId: 'final', scheduledDate: TUE }],
        dates: DATES,
      }),
    ).toEqual([]);
    expect(dateBoundsNotes({ dates: DATES })).toEqual([]);
  });

  it('reports both cuts when the matchUp is boxed in on both sides', () => {
    const notes = dateBoundsNotes({
      earliestDate: SUN,
      latestDate: MON,
      orderedBy: [
        { relation: 'source', matchUpId: 'src', scheduledDate: SUN },
        { relation: 'dependent', matchUpId: 'dep', scheduledDate: MON },
      ],
      dates: DATES,
    });
    expect(notes.map((note) => note.key)).toEqual([NOT_AFTER, NOT_BEFORE]);
  });
});
