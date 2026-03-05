/**
 * Auto-assign a court SVG as tournament image when a draw is created,
 * if the tournament has no existing image.
 */
import { tournamentEngine } from 'tods-competition-factory';

import { resolveCourtSport, sportFromMatchUpFormat, COURT_SVG_RESOURCE_SUB_TYPE } from 'services/courtSvg/courtSvgUtil';
import { ADD_ONLINE_RESOURCE } from 'constants/mutationConstants';

/**
 * Check whether the tournament already has an image (URL or court SVG).
 */
function hasTournamentImage(): boolean {
  const { tournamentRecord } = tournamentEngine.getTournament();
  return tournamentRecord?.onlineResources?.some(
    ({ name }: any) => name === 'tournamentImage',
  );
}

/**
 * Build an ADD_ONLINE_RESOURCE mutation method to set a court SVG as the tournament image.
 * Returns undefined if the tournament already has an image or the sport has no court SVG.
 *
 * @param eventId - the event the draw belongs to
 * @param matchUpFormat - the format chosen for the new draw (fallback when event has none)
 */
export function getAutoCourtImageMethod(
  eventId: string,
  matchUpFormat?: string,
): { method: string; params: any } | undefined {
  if (hasTournamentImage()) return undefined;

  const event = tournamentEngine.getEvent({ eventId })?.event;
  // Try event-level sport first, then fall back to the draw's matchUpFormat
  const sport = resolveCourtSport(event) ?? sportFromMatchUpFormat(matchUpFormat);
  if (!sport) return undefined;

  return {
    method: ADD_ONLINE_RESOURCE,
    params: {
      onlineResource: {
        resourceSubType: COURT_SVG_RESOURCE_SUB_TYPE,
        name: 'tournamentImage',
        resourceType: 'OTHER',
        identifier: sport,
      },
    },
  };
}
