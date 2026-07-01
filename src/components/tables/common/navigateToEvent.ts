import { setPendingMatchUpFocus } from 'services/dom/matchUpFocus';
import { tournamentEngine } from 'services/factory/engine';
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
  ROUNDS_SWISS_CHART,
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
  const tournamentId = tournamentEngine.q.tournament()?.tournamentId;

  // No eventId — navigate to events list
  if (!eventId) {
    const route = `/${TOURNAMENT}/${tournamentId}/${EVENTS_TAB}`;
    context.router?.navigate(route);
    context.router?.resolve();
    return;
  }

  const event = tournamentEngine.q.event({ eventId, drawId });
  const singleDraw = event?.drawDefinitions?.length === 1 && event.drawDefinitions[0];

  if (participantId && singleDraw) {
    drawId = singleDraw.drawId;
    renderDraw = true;
  }

  if (matchUpId) {
    // Resolve the matchUp's draw AND structure so navigation lands on the
    // correct structure (not the draw's default) — inContext hydration carries
    // structureId. The matchUp itself is scrolled-to + highlighted after render
    // via the pending focus stashed below.
    for (const dd of event?.drawDefinitions ?? []) {
      const matchUps = tournamentEngine.q.drawMatchUps({ drawId: dd.drawId, inContext: true });
      const found = matchUps.find((matchUp: any) => matchUp.matchUpId === matchUpId);
      if (found) {
        drawId = dd.drawId;
        if (!structureId) structureId = found.structureId;
        break;
      }
    }
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
    if ([ROUNDS_COLUMNS, ROUNDS_TABLE, ROUNDS_STATS, ROUNDS_BRACKET, ROUNDS_RATINGS, ROUNDS_STANDINGS, ROUNDS_SWISS_CHART].includes(view || '')) {
      route += `/${VIEW}/${view}`;
    }
  } else if (renderDraw && !drawId) {
    route += '/draws';
  } else if (drawId) {
    route += `/${DRAW_ENTRIES}/${drawId}`;
  }

  // Stash the matchUp so renderDrawView can scroll-to + highlight it once the
  // target structure has rendered (matchUpId isn't part of the route).
  if (matchUpId && renderDraw && drawId) setPendingMatchUpFocus(matchUpId);

  context.router?.navigate(route);
  context.router?.resolve();
}
