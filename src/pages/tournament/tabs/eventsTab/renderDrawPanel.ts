import { tournamentEngine } from 'services/factory/engine';

type RenderDrawPanelParams = {
  eventId: string;
  drawId: string;
  headerElement?: HTMLElement;
};

export function renderDrawPanel({ eventId, drawId }: RenderDrawPanelParams): { success?: boolean } {
  const { event, drawDefinition } = tournamentEngine.getEvent({ eventId, drawId });
  if (event && drawDefinition) {
    return { success: true };
  } else {
    return {};
  }
}
