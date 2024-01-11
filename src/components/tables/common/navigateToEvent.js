import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { DRAW_ENTRIES, DRAW, EVENT, STRUCTURE, TOURNAMENT } from 'constants/tmxConstants';

export function navigateToEvent({ eventId, drawId, structureId, renderDraw, participantId, matchUpId }) {
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
  const event = eventId && tournamentEngine.getEvent({ eventId, drawId }).event;
  const singleDraw = event?.drawDefinitions?.length === 1 && event.drawDefinitions[0];

  if (participantId && singleDraw) {
    drawId = singleDraw.drawId;
    renderDraw = true;
  }

  if (matchUpId) {
    drawId = event.drawDefinitions.find(({ drawId }) => {
      const matchUps = tournamentEngine.allDrawMatchUps({ drawId, inContext: false }).matchUps;
      return matchUps.find((matchUp) => matchUp.matchUpId === matchUpId);
    })?.drawId;
    renderDraw = !!drawId;
  }

  let route = `/${TOURNAMENT}/${tournamentId}/${EVENT}/${eventId}`;
  if (renderDraw && drawId) {
    route += `/${DRAW}/${drawId}`;
    if (structureId) route += `/${STRUCTURE}/${structureId}`;
  } else if (drawId) {
    route += `/${DRAW_ENTRIES}/${drawId}`;
  }

  context.router.navigate(route);
}
