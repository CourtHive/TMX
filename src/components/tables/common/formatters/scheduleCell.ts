import { matchUpDragStart } from 'components/tables/scheduleTable/matchUpDragStart';
import { matchUpDrop } from 'components/tables/scheduleTable/matchUpDrop';
import { factoryConstants } from 'tods-competition-factory';
import { timeFormat } from 'functions/timeStrings';

import { CONFLICT_COURT_DOUBLE_BOOKING, timeModifierDisplay } from 'constants/tmxConstants';

const { SCHEDULE_STATE, SCHEDULE_ERROR, SCHEDULE_WARNING, SCHEDULE_CONFLICT, SCHEDULE_ISSUE } =
  factoryConstants.scheduleConstants;
const { ABANDONED, CANCELLED, DEFAULTED, DOUBLE_DEFAULT, DOUBLE_WALKOVER, IN_PROGRESS, WALKOVER } =
  factoryConstants.matchUpStatusConstants;
const { completedMatchUpStatuses } = factoryConstants;

function buildBlockedCell(content: HTMLSpanElement, booking: any): HTMLSpanElement {
  content.className = 'schedule-cell blocked-cell';
  content.dataset.bookingType = booking.bookingType || 'BLOCKED';

  const blockLabel = document.createElement('div');
  blockLabel.className = 'block-label';

  const blockType = document.createElement('div');
  blockType.className = 'block-type';
  blockType.textContent = booking.bookingType || 'BLOCKED';
  blockLabel.appendChild(blockType);

  if (booking.rowCount && booking.rowCount > 1) {
    const rowInfo = document.createElement('div');
    rowInfo.className = 'block-rows';
    rowInfo.textContent = `${booking.rowCount} rows`;
    blockLabel.appendChild(rowInfo);
  }

  if (booking.notes) {
    const notes = document.createElement('div');
    notes.className = 'block-notes';
    notes.textContent = booking.notes;
    blockLabel.appendChild(notes);
  }

  content.appendChild(blockLabel);
  return content;
}

function applyMatchUpStatusClass(
  content: HTMLSpanElement,
  matchUpStatus: string | undefined,
  winningSide: any,
  scheduleState: string | undefined,
  issueType: string | undefined,
): void {
  if (matchUpStatus === ABANDONED) {
    content.classList.add('matchup-abandoned');
  } else if (matchUpStatus === CANCELLED) {
    content.classList.add('matchup-cancelled');
  } else if (matchUpStatus === DOUBLE_WALKOVER || matchUpStatus === DOUBLE_DEFAULT) {
    content.classList.add('matchup-double-walkover-default');
  } else if (winningSide) {
    content.classList.add('matchup-complete');
  } else if (matchUpStatus === IN_PROGRESS) {
    content.classList.add('matchup-inprogress');
  } else if (scheduleState === SCHEDULE_CONFLICT) {
    if (issueType === CONFLICT_COURT_DOUBLE_BOOKING) {
      content.classList.add('matchup-double-booking');
    } else {
      content.classList.add('matchup-conflict');
    }
  } else if (scheduleState === SCHEDULE_ISSUE) {
    content.classList.add('matchup-issue');
  } else if (scheduleState === SCHEDULE_WARNING) {
    content.classList.add('matchup-warning');
  } else if (scheduleState === SCHEDULE_ERROR) {
    content.classList.add('matchup-error');
  }
}

function attachConflictHighlighters(
  content: HTMLSpanElement,
  issueIds: string[],
): void {
  content.addEventListener('mouseenter', () => {
    for (const relatedId of issueIds) {
      const relatedCell = document.getElementById(relatedId);
      if (relatedCell) {
        relatedCell.classList.add('conflict-highlight');
      }
    }
  });

  content.addEventListener('mouseleave', () => {
    for (const relatedId of issueIds) {
      const relatedCell = document.getElementById(relatedId);
      if (relatedCell) {
        relatedCell.classList.remove('conflict-highlight');
      }
    }
  });
}

function buildSideElement(
  side: { text: string; bold: boolean } | undefined,
  potential: string | undefined,
): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'scheduled_team';
  el.style.fontSize = '1em';
  if (side) {
    el.textContent = side.text;
    if (side.bold) el.style.fontWeight = 'bold';
  } else if (potential) {
    el.innerHTML = potential;
  } else {
    el.textContent = 'Unknown';
  }
  return el;
}

function appendMatchResult(
  scheduledTeams: HTMLDivElement,
  matchUpStatus: string | undefined,
  winningSide: any,
  score: any,
): void {
  if (winningSide) {
    const scoreLine = document.createElement('div');
    scoreLine.className = 'match_status';

    if (matchUpStatus === WALKOVER) {
      scoreLine.innerHTML = 'WALKOVER';
    } else if (matchUpStatus === DEFAULTED) {
      scoreLine.innerHTML = 'DEFAULTED';
    } else {
      scoreLine.innerHTML = score?.scoreStringSide1 || '';
    }

    scheduledTeams.appendChild(scoreLine);
  } else if ([DOUBLE_DEFAULT, DOUBLE_WALKOVER].includes(matchUpStatus)) {
    const statusLine = document.createElement('div');
    statusLine.className = 'match_status';
    statusLine.innerHTML = matchUpStatus === DOUBLE_DEFAULT ? 'DBL DEFAULT' : 'DBL WALKOVER';
    scheduledTeams.appendChild(statusLine);
  } else if (matchUpStatus && [ABANDONED, CANCELLED].includes(matchUpStatus)) {
    const statusLine = document.createElement('div');
    statusLine.className = 'match_status';
    statusLine.innerHTML = matchUpStatus;
    scheduledTeams.appendChild(statusLine);
  }
}

export function scheduleCell(cell: any): HTMLSpanElement {
  const content = document.createElement('span');

  const inactive = !cell.getColumn().getDefinition().field;

  if (inactive) {
    content.className = 'schedule-cell';
    return content;
  }

  const value = cell.getValue();

  if (value?.isBlocked) {
    return buildBlockedCell(content, value.booking);
  }

  const {
    potentialParticipants,
    eventName = '',
    roundName = '',
    schedule = {},
    matchUpStatus,
    winningSide,
    matchUpId,
    sides,
    issueType,
    issueIds,
  } = value || {};

  const {
    courtOrder = '',
    scheduledTime = '',
    startTime = '',
    courtId = '',
    timeModifiers,
    venueId = '',
  } = schedule;
  content.setAttribute('courtOrder', courtOrder);
  content.setAttribute('courtId', courtId);
  content.setAttribute('venueId', venueId);

  content.className = 'schedule-cell dragdrop';
  content.ondragover = (e) => e.preventDefault();

  if (matchUpId) {
    content.draggable = true;
    content.id = matchUpId;
    const schedState = schedule[SCHEDULE_STATE];
    applyMatchUpStatusClass(content, matchUpStatus, winningSide, schedState, issueType);
  }

  content.addEventListener('drop', (e) => matchUpDrop(e, cell));
  content.addEventListener('dragstart', matchUpDragStart);

  const scheduleState = schedule[SCHEDULE_STATE];
  const isCompleted = matchUpStatus && completedMatchUpStatuses.includes(matchUpStatus);
  const conflictStates = new Set([SCHEDULE_CONFLICT, SCHEDULE_WARNING, SCHEDULE_ERROR, SCHEDULE_ISSUE]);
  const hasConflict = scheduleState && conflictStates.has(scheduleState);

  if (matchUpId && issueIds && issueIds.length > 0 && hasConflict && !isCompleted) {
    attachConflictHighlighters(content, issueIds);
  }

  if (!matchUpId) {
    return content;
  }

  const roundHeader = `${eventName} ${roundName}`;
  const getPotentialName = (participant: any) =>
    participant.person?.standardFamilyName?.toUpperCase() || participant.participantName;
  const potentials = potentialParticipants?.map((potential: any) =>
    potential
      ?.map((participant: any) => `<span class='potential nowrap'>${getPotentialName(participant)}</span>`)
      .join('<span style="font-weight: bold">&nbsp;or&nbsp;</span>'),
  );
  const getParticipantName = (sideNumber: number): { text: string; bold: boolean } | undefined => {
    const participantName = sides?.find((side: any) => sideNumber === side.sideNumber)?.participant?.participantName;
    if (!participantName) return undefined;
    return { text: participantName, bold: winningSide === sideNumber };
  };
  const side1 = getParticipantName(1);
  const side2 = getParticipantName(2);
  const side1Potential = side1 ? undefined : potentials?.shift();
  const side2Potential = side2 ? undefined : potentials?.shift();

  content.id = matchUpId;

  const timeDetail = document.createElement('div');
  timeDetail.className = 'header flexrow';
  const displayTime = scheduledTime || startTime;
  timeDetail.innerHTML =
    ((timeModifiers?.[0] && timeModifierDisplay[timeModifiers[0]] + '&nbsp;') || '') + timeFormat(displayTime);
  content.appendChild(timeDetail);

  const roundDetail = document.createElement('div');
  roundDetail.className = 'catround';
  roundDetail.innerHTML = roundHeader;
  content.appendChild(roundDetail);

  const scheduledTeams = document.createElement('div');
  scheduledTeams.className = 'scheduled_teams';

  scheduledTeams.appendChild(buildSideElement(side1, side1Potential));

  const divider = document.createElement('div');
  divider.className = 'divider';
  divider.textContent = 'vs.';
  scheduledTeams.appendChild(divider);

  scheduledTeams.appendChild(buildSideElement(side2, side2Potential));

  appendMatchResult(scheduledTeams, matchUpStatus, winningSide, value?.score);

  content.appendChild(scheduledTeams);

  return content;
}
