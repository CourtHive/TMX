import { hasFinalResult } from 'functions/hasFinalResult';

const TERMINAL_STATUSES = new Set([
  'BYE',
  'WALKOVER',
  'DOUBLE_WALKOVER',
  'CANCELLED',
  'ABANDONED',
  'DOUBLE_DEFAULT',
  'DEFAULTED',
]);

export type MatchUpMenuGates = {
  /** no participant on either side yet */
  noParticipants: boolean;
  /** start and end time are not offered */
  hideTimeOptions: boolean;
  /** what readies, staffs or clears a match still to be played: clear schedule, check-in, print, scorekeeper */
  hidePrePlay: boolean;
  /** the per-matchUp check-in desk */
  hideCheckIn: boolean;
};

/**
 * Which of the matchUp popover's items a matchUp is offered, decided in TMX until the factory's `matchUpActions`
 * carries them. The status list omits COMPLETED and RETIRED, so a finished match used to be offered the actions of one
 * still to play: check-in, a scorekeeper, a match card, a schedule clear. Its date, times and official stay editable
 * (CA, 2026-10-30).
 */
export function matchUpMenuGates(matchUp: any): MatchUpMenuGates {
  const noParticipants = !matchUp?.sides?.some((side: any) => side?.participantId);
  const isTerminal = TERMINAL_STATUSES.has(matchUp?.matchUpStatus);
  const hidePrePlay = hasFinalResult(matchUp);
  return {
    hideCheckIn: noParticipants || isTerminal || hidePrePlay,
    hideTimeOptions: noParticipants || isTerminal,
    noParticipants,
    hidePrePlay,
  };
}
