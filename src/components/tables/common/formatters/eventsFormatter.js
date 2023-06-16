import { eventConstants } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';

const { SINGLES } = eventConstants;

export const eventsFormatter = (eventClick) => (cell) => {
  const def = cell.getColumn().getDefinition();
  const content = document.createElement('div');
  content.className = 'tags';

  const events = cell.getValue();
  const rowData = cell.getRow().getData();
  const { participantId } = rowData;
  events.forEach((event) => {
    const pill = createPill({ def, participantId, event, eventClick });
    content.appendChild(pill);
  });

  return content;
};

function createPill({ matchUpId, participantId, event, eventClick }) {
  const pill = document.createElement('span');
  if (isFunction(eventClick)) {
    pill.onclick = () => eventClick({ eventId: event.eventId, participantId, matchUpId });
  }
  pill.className = 'tag event-pill';
  if (event.gender?.toLowerCase().includes('female')) {
    pill.classList.add('is-danger');
  } else if (event.gender?.toLowerCase().includes('male')) {
    pill.classList.add('is-link');
  } else {
    pill.classList.add('is-primary');
  }
  if (event.eventType === SINGLES) {
    pill.classList.add('is-light');
  }
  pill.innerHTML = event.eventName;
  return pill;
}

export const eventFormatter = (eventClick) => (cell) => {
  const def = cell.getColumn().getDefinition();
  const rowData = cell.getRow().getData();
  const { matchUpId } = rowData;

  const content = document.createElement('div');
  content.className = 'tags';
  const pill = createPill({ def, matchUpId, event: rowData, eventClick });
  content.append(pill);

  return content;
};
