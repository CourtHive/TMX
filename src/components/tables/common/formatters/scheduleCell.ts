import { matchUpDragStart } from 'components/tables/scheduleTable/matchUpDragStart';
import { matchUpDrop } from 'components/tables/scheduleTable/matchUpDrop';
import { factoryConstants } from 'tods-competition-factory';
import { timeFormat } from 'functions/timeStrings';

import { SCHEDULE_ISSUE, timeModifierDisplay } from 'constants/tmxConstants';

const { SCHEDULE_STATE, SCHEDULE_ERROR, SCHEDULE_WARNING, SCHEDULE_CONFLICT } = factoryConstants.scheduleConstants;
const { ABANDONED, CANCELLED, DEFAULTED, DOUBLE_DEFAULT, DOUBLE_WALKOVER, IN_PROGRESS, WALKOVER } =
  factoryConstants.matchUpStatusConstants;

export function scheduleCell(cell: any): HTMLSpanElement {
  const content = document.createElement('span');

  const inactive = !cell.getColumn().getDefinition().field;

  if (inactive) {
    content.className = 'schedule-cell';
    return content;
  }

  const value = cell.getValue();

  // Handle blocked cells
  if (value?.isBlocked) {
    const booking = value.booking;
    content.className = 'schedule-cell blocked-cell';
    content.setAttribute('data-booking-type', booking.bookingType || 'BLOCKED');

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
  const {
    potentialParticipants,
    eventName = '',
    roundName = '',
    schedule = {},
    matchUpStatus,
    winningSide,
    matchUpId,
    sides,
  } = value || {};

  const { courtOrder = '', scheduledTime = '', courtId = '', timeModifiers, venueId = '' } = schedule;
  content.setAttribute('courtOrder', courtOrder);
  content.setAttribute('courtId', courtId);
  content.setAttribute('venueId', venueId);

  content.className = 'schedule-cell dragdrop';
  content.ondragover = (e) => e.preventDefault();

  if (matchUpId) {
    content.draggable = true;
    content.id = matchUpId;

    if (matchUpStatus === ABANDONED) {
      content.classList.add('matchup-abandoned');
    } else if (matchUpStatus === CANCELLED) {
      content.classList.add('matchup-cancelled');
    } else if (matchUpStatus === DOUBLE_WALKOVER || matchUpStatus === DOUBLE_DEFAULT) {
      content.classList.add('matchup-double-walkover-default');
    } else if (winningSide) {
      content.classList.add('matchup-complete');
    } else {
      const scheduleState = schedule[SCHEDULE_STATE];
      if (matchUpStatus === IN_PROGRESS) {
        content.classList.add('matchup-inprogress');
      } else if (scheduleState === SCHEDULE_CONFLICT) {
        content.classList.add('matchup-conflict');
      } else if (scheduleState === SCHEDULE_ISSUE) {
        content.classList.add('matchup-issue');
      } else if (scheduleState === SCHEDULE_WARNING) {
        content.classList.add('matchup-warning');
      } else if (scheduleState === SCHEDULE_ERROR) {
        content.classList.add('matchup-error');
      }
    }
  }

  content.addEventListener('drop', (e) => matchUpDrop(e, cell));
  content.addEventListener('dragstart', matchUpDragStart);

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
  const getParticiapntName = (sideNumber: number) => {
    const participantName = sides?.find((side: any) => sideNumber === side.sideNumber)?.participant?.participantName;
    if (!participantName) return;
    return winningSide === sideNumber ? `<span style='font-weight: bold'>${participantName}</span>` : participantName;
  };
  const side1 = getParticiapntName(1) || potentials?.shift() || 'Unkown';
  const side2 = getParticiapntName(2) || potentials?.shift() || 'Unknown';

  content.id = matchUpId;

  const timeDetail = document.createElement('div');
  timeDetail.className = 'header flexrow';
  timeDetail.innerHTML =
    ((timeModifiers?.[0] && timeModifierDisplay[timeModifiers[0]] + '&nbsp;') || '') + timeFormat(scheduledTime);
  content.appendChild(timeDetail);

  const roundDetail = document.createElement('div');
  roundDetail.className = 'catround';
  roundDetail.innerHTML = roundHeader;
  content.appendChild(roundDetail);

  const scheduledTeams = document.createElement('div');
  scheduledTeams.className = 'scheduled_teams';
  const side1El = document.createElement('div');
  side1El.className = 'scheduled_team';
  side1El.style.fontSize = '1em';
  side1El.innerHTML = side1;
  scheduledTeams.appendChild(side1El);

  const divider = document.createElement('div');
  divider.className = 'divider';
  divider.innerHTML = 'vs.';
  scheduledTeams.appendChild(divider);

  const side2El = document.createElement('div');
  side2El.className = 'scheduled_team';
  side2El.style.fontSize = '1em';
  side2El.innerHTML = side2;
  scheduledTeams.appendChild(side2El);

  if (winningSide) {
    const scoreLine = document.createElement('div');
    scoreLine.className = 'match_status';

    // Check if the match was won by WALKOVER or DEFAULTED
    if (matchUpStatus === WALKOVER) {
      scoreLine.innerHTML = 'WALKOVER';
    } else if (matchUpStatus === DEFAULTED) {
      scoreLine.innerHTML = 'DEFAULTED';
    } else {
      // Display normal score
      scoreLine.innerHTML = value.score?.scoreStringSide1 || '';
    }

    scheduledTeams.appendChild(scoreLine);
  } else if ([DOUBLE_DEFAULT, DOUBLE_WALKOVER].includes(matchUpStatus)) {
    const statusLine = document.createElement('div');
    statusLine.className = 'match_status';
    statusLine.innerHTML = matchUpStatus === DOUBLE_DEFAULT ? 'DBL DEFAULT' : 'DBL WALKOVER';
    scheduledTeams.appendChild(statusLine);
  } else if ([ABANDONED, CANCELLED].includes(matchUpStatus)) {
    const statusLine = document.createElement('div');
    statusLine.className = 'match_status';
    statusLine.innerHTML = matchUpStatus;
    scheduledTeams.appendChild(statusLine);
  }

  content.appendChild(scheduledTeams);

  return content;
}
