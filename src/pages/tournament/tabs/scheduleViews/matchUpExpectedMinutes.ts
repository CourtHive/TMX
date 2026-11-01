/**
 * The schedule grid's expected duration for one matchUp, as the factory resolves it.
 *
 * The grid reads it in two places: the Now strip's runway (when does the match on this court
 * finish) and the drop guard (does this match fit before the court's next block). Both used to
 * ask `getMatchUpFormatTiming` with only the format and type, so an event's own timing, set with
 * `modifyEventMatchUpFormatTiming`, never reached them: the grid kept using the policy figure.
 *
 * The matchUp's `eventId` is passed, and the engine resolves it to the event, whose timing
 * `getScheduleTiming` reads. When a matchUp carries a `drawId` but no `eventId`, the event is
 * found from the draw.
 */

import { competitionEngine, tournamentEngine } from 'services/factory/engine';

/** The fields of a matchUp the timing lookup reads. */
export interface TimedMatchUp {
  matchUpFormat?: string;
  matchUpType?: string;
  eventId?: string;
  drawId?: string;
}

/** The event that holds a draw, in the active tournament. */
function eventForDraw(drawId?: string): any {
  if (!drawId) return undefined;
  const { tournamentRecord }: any = tournamentEngine.getTournament() || {};
  return (tournamentRecord?.events || []).find((event: any) =>
    (event.drawDefinitions || []).some((draw: any) => draw.drawId === drawId),
  );
}

/** The matchUp's own format, else its draw's. */
export function resolveMatchUpFormat(matchUp: TimedMatchUp | undefined): string | undefined {
  if (matchUp?.matchUpFormat) return matchUp.matchUpFormat;
  const event = eventForDraw(matchUp?.drawId);
  return event?.drawDefinitions?.find((draw: any) => draw.drawId === matchUp?.drawId)?.matchUpFormat;
}

/** The average minutes for a matchUp, or undefined when its format or timing cannot be resolved. */
export function expectedAverageMinutes(matchUp: TimedMatchUp | undefined): number | undefined {
  const matchUpFormat = resolveMatchUpFormat(matchUp);
  if (!matchUpFormat) return undefined;
  const eventId = matchUp?.eventId ?? eventForDraw(matchUp?.drawId)?.eventId;
  try {
    const timing: any = competitionEngine.getMatchUpFormatTiming?.({
      // a plain string on the hydrated matchUp; the engine validates it and falls back to SINGLES
      eventType: matchUp?.matchUpType as any,
      matchUpFormat,
      ...(eventId && { eventId }),
    });
    const average = Number(timing?.averageMinutes);
    return Number.isFinite(average) && average > 0 ? average : undefined;
  } catch {
    return undefined;
  }
}
