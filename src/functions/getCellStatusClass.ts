/**
 * Determine the CSS class for a schedule cell based on matchUp status and schedule state.
 * Returns the class name to add, or undefined if no special status applies.
 */
export function getCellStatusClass({
  matchUpStatus,
  winningSide,
  scheduleState,
  issueType,
  statusConstants,
}: {
  matchUpStatus?: string;
  winningSide?: number;
  scheduleState?: string;
  issueType?: string;
  statusConstants: {
    ABANDONED: string;
    CANCELLED: string;
    DOUBLE_WALKOVER: string;
    DOUBLE_DEFAULT: string;
    IN_PROGRESS: string;
    SCHEDULE_CONFLICT: string;
    SCHEDULE_ISSUE: string;
    SCHEDULE_WARNING: string;
    SCHEDULE_ERROR: string;
    CONFLICT_COURT_DOUBLE_BOOKING: string;
  };
}): string | undefined {
  const {
    ABANDONED,
    CANCELLED,
    DOUBLE_WALKOVER,
    DOUBLE_DEFAULT,
    IN_PROGRESS,
    SCHEDULE_CONFLICT,
    SCHEDULE_ISSUE,
    SCHEDULE_WARNING,
    SCHEDULE_ERROR,
    CONFLICT_COURT_DOUBLE_BOOKING,
  } = statusConstants;

  if (matchUpStatus === ABANDONED) return 'matchup-abandoned';
  if (matchUpStatus === CANCELLED) return 'matchup-cancelled';
  if (matchUpStatus === DOUBLE_WALKOVER || matchUpStatus === DOUBLE_DEFAULT) return 'matchup-double-walkover-default';
  if (winningSide) return 'matchup-complete';

  if (matchUpStatus === IN_PROGRESS) return 'matchup-inprogress';
  if (scheduleState === SCHEDULE_CONFLICT) {
    return issueType === CONFLICT_COURT_DOUBLE_BOOKING ? 'matchup-double-booking' : 'matchup-conflict';
  }
  if (scheduleState === SCHEDULE_ISSUE) return 'matchup-issue';
  if (scheduleState === SCHEDULE_WARNING) return 'matchup-warning';
  if (scheduleState === SCHEDULE_ERROR) return 'matchup-error';

  return undefined;
}
