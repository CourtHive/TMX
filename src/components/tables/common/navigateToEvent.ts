import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import {
  DRAW_ENTRIES,
  DRAW,
  EVENT,
  EVENTS_TAB,
  STRUCTURE,
  TOURNAMENT,
  ROUNDS_BRACKET,
  ROUNDS_COLUMNS,
  ROUNDS_RATINGS,
  ROUNDS_STANDINGS,
  ROUNDS_TABLE,
  ROUNDS_STATS,
  VIEW,
} from 'constants/tmxConstants';

type NavigateToEventParams = {
  eventId?: string;
  drawId?: string;
  structureId?: string;
  renderDraw?: boolean;
  renderPoints?: boolean;
  participantId?: string;
  matchUpId?: string;
  view?: string;
};

export function navigateToEvent({ eventId, drawId, structureId, renderDraw, renderPoints, participantId, matchUpId, view }: NavigateToEventParams = {}): void {
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;

  // No eventId — navigate to events list
  if (!eventId) {
    const route = `/${TOURNAMENT}/${tournamentId}/${EVENTS_TAB}`;
    context.router?.navigate(route);
    context.router?.resolve();
    return;
  }

  const event = tournamentEngine.getEvent({ eventId, drawId }).event;
  const singleDraw = event?.drawDefinitions?.length === 1 && event.drawDefinitions[0];

  if (participantId && singleDraw) {
    drawId = singleDraw.drawId;
    renderDraw = true;
  }

  if (matchUpId) {
    drawId = event.drawDefinitions.find(({ drawId }: any) => {
      const matchUps = tournamentEngine.allDrawMatchUps({ drawId, inContext: false }).matchUps;
      return matchUps.find((matchUp: any) => matchUp.matchUpId === matchUpId);
    })?.drawId;
    renderDraw = !!drawId;
  }

  let route = `/${TOURNAMENT}/${tournamentId}/${EVENT}/${eventId}`;
  if (renderPoints) {
    route += '/points';
    context.router?.navigate(route);
    context.router?.resolve();
    return;
  }
  if (renderDraw && drawId) {
    route += `/${DRAW}/${drawId}`;
    if (structureId) {
      route += `/${STRUCTURE}/${structureId}`;
    }
    if ([ROUNDS_COLUMNS, ROUNDS_TABLE, ROUNDS_STATS, ROUNDS_BRACKET, ROUNDS_RATINGS, ROUNDS_STANDINGS].includes(view || '')) {
      route += `/${VIEW}/${view}`;
    }
  } else if (renderDraw && !drawId) {
    route += '/draws';
  } else if (drawId) {
    route += `/${DRAW_ENTRIES}/${drawId}`;
  }

  context.router?.navigate(route);
  context.router?.resolve();
}
