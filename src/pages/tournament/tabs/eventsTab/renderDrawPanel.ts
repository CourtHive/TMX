import { tournamentEngine } from 'tods-competition-factory';

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
