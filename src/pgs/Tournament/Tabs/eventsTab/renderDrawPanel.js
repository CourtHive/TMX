import { tournamentEngine } from 'tods-competition-factory';

export function renderDrawPanel({ eventId, drawId, headerElement }) {
  const { event, drawDefinition } = tournamentEngine.getEvent({ eventId, drawId });
  if (event && drawDefinition) {
    headerElement.innerHTML = event.eventName;
    return { success: true };
  } else {
    return {};
  }
}
