/**
 * Why the schedule-date picker offers fewer days than the tournament has (CA 2026-11-22, Battle of Boca).
 *
 * The factory's bounds (`getMatchUpScheduleBounds`) cut the range at the latest dated matchUp that feeds this one and
 * at the earliest dated matchUp this one feeds. A greyed-out day with no reason read as a defect, and a director at
 * Boca could not tell that the R32 match left on Saturday's schedule was what kept its R64 off Sunday. The note names
 * the matchUp that sets each cut, so the operator knows what to move.
 *
 * Pure: the caller resolves a limiting matchUp's description (its round and sides).
 */
export type BoundingMatchUp = {
  relation: 'source' | 'dependent';
  matchUpId: string;
  scheduledDate?: string;
  scheduledTime?: string;
};

export type DateBoundsNote = {
  key: 'schedule.dateBounds.notAfter' | 'schedule.dateBounds.notBefore';
  date: string;
  matchUpId: string;
  scheduledTime?: string;
};

/**
 * One entry per side the bounds cut short of the tournament's own range: `notAfter` when a matchUp this one feeds is
 * dated before the range ends, `notBefore` when a matchUp feeding this one is dated after it starts.
 */
export function dateBoundsNotes({
  orderedBy = [],
  earliestDate,
  latestDate,
  dates,
}: {
  orderedBy?: BoundingMatchUp[];
  earliestDate?: string;
  latestDate?: string;
  /** the tournament's schedulable dates, ascending */
  dates: string[];
}): DateBoundsNote[] {
  const first = dates[0];
  const last = dates.at(-1);
  const notes: DateBoundsNote[] = [];

  // the dependent that cuts the range is the earliest on its day; the source, the latest on its day
  const limiting = (relation: BoundingMatchUp['relation'], date: string) => {
    const onDate = orderedBy
      .filter((matchUp) => matchUp.relation === relation && matchUp.scheduledDate === date)
      .sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''));
    return relation === 'dependent' ? onDate[0] : onDate.at(-1);
  };
  const note = (key: DateBoundsNote['key'], date: string, matchUp?: BoundingMatchUp) => {
    if (matchUp) notes.push({ key, date, matchUpId: matchUp.matchUpId, scheduledTime: matchUp.scheduledTime });
  };

  if (latestDate && last && latestDate < last) {
    note('schedule.dateBounds.notAfter', latestDate, limiting('dependent', latestDate));
  }
  if (earliestDate && first && earliestDate > first) {
    note('schedule.dateBounds.notBefore', earliestDate, limiting('source', earliestDate));
  }
  return notes;
}
