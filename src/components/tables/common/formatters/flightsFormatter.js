import { eventConstants } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';

const { SINGLES } = eventConstants;

export const flightsFormatter = (onClick) => (cell) => {
  const def = cell.getColumn().getDefinition();
  const content = document.createElement('div');
  content.className = 'tags';

  const flightClick = (params) => onClick({ ...params, renderDraw: true });

  const flights = cell.getValue();
  const rowData = cell.getRow().getData();
  const { participantId } = rowData;
  flights.forEach((flight) => {
    const pill = createPill({ def, participantId, flight, flightClick });
    content.appendChild(pill);
  });

  return content;
};

function createPill({ flight, flightClick }) {
  const pill = document.createElement('span');
  if (isFunction(flightClick)) {
    pill.onclick = () => flightClick(flight);
  }
  pill.className = 'tag event-pill';
  if (flight.gender?.toLowerCase().includes('female')) {
    pill.classList.add('is-danger');
  } else if (flight.gender?.toLowerCase().includes('male')) {
    pill.classList.add('is-link');
  } else {
    pill.classList.add('is-primary');
  }
  if (flight.eventType === SINGLES) {
    pill.classList.add('is-light');
  }
  pill.innerHTML = flight.drawName;
  return pill;
}
