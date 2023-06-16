import { tournamentEngine } from 'tods-competition-factory';

export function renderDrawPanel({ eventId, drawId }) {
  const { event, drawDefinition } = tournamentEngine.getEvent({ eventId, drawId });
  if (event && drawDefinition) {
    return { success: true };
  } else {
    return {};
  }
}
