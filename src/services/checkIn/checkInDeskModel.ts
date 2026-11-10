import { factoryConstants } from 'tods-competition-factory';
import { getMatchUpCheckInState } from './checkInState';

const COMPLETED = new Set<string>(factoryConstants.completedMatchUpStatuses);
export type CheckInFilter = 'all' | 'awaiting' | 'partial' | 'complete';
export interface DeskFilters {
  search: string;
  status: CheckInFilter;
  eventId: string;
  venueId: string;
  showCompleted: boolean;
}

/** Date-scoped, draw-type independent and never mutates the engine's array. */
export function checkInDeskMatchUps(matchUps: any[], date: string, filters: DeskFilters): any[] {
  const search = filters.search
    .trim()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
  return matchUps
    .filter((matchUp) => {
      if (matchUp.schedule?.scheduledDate !== date || matchUp.matchUpStatus === 'BYE') return false;
      if (!filters.showCompleted && COMPLETED.has(matchUp.matchUpStatus)) return false;
      if (filters.eventId && matchUp.eventId !== filters.eventId) return false;
      if (filters.venueId && matchUp.schedule?.venueId !== filters.venueId) return false;
      const state = getMatchUpCheckInState(matchUp);
      if (!state.hasParticipants) return false;
      if (filters.status === 'awaiting' && state.allCheckedIn) return false;
      if (filters.status === 'partial' && !state.partial) return false;
      if (filters.status === 'complete' && !state.allCheckedIn) return false;
      const names = state.participants
        .map((participant) => participant.participantName)
        .join(' ')
        .normalize('NFD')
        .replaceAll(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase();
      return !search || names.includes(search);
    })
    .toSorted(
      (a, b) =>
        (a.schedule?.scheduledTime || '99:99').localeCompare(b.schedule?.scheduledTime || '99:99') ||
        (a.schedule?.courtName || '').localeCompare(b.schedule?.courtName || '', undefined, { numeric: true }) ||
        a.matchUpId.localeCompare(b.matchUpId),
    );
}
