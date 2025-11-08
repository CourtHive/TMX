import { tournamentEngine } from 'tods-competition-factory';

type RenderDrawPanelParams = {
  eventId: string;
  drawId: string;
  headerElement: HTMLElement;
};

export function renderDrawPanel({ eventId, drawId, headerElement }: RenderDrawPanelParams): { success?: boolean } {
  const { event, drawDefinition } = tournamentEngine.getEvent({ eventId, drawId });
  if (event && drawDefinition) {
    headerElement.innerHTML = event.eventName;
    return { success: true };
  } else {
    return {};
  }
}
