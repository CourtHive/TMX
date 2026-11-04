/**
 * A dual's home team, for the scorecard and the dual's ⋮ menu.
 *
 * - Who is home comes from the factory's `resolveHomeParticipantId`: an explicit home (set with
 *   `setMatchUpHomeParticipantId`) wins, else a home venue or the host organisation can infer one, else there is none.
 *   No side is ever assumed.
 * - Set: `setMatchUpHomeParticipantId` with one of the dual's two teams. Clear: the same method with an empty id, which
 *   the factory takes as removing it. Only an explicit home can be cleared; an inferred one has nothing stored.
 *
 * Lives in its own module so it can be tested without importing the overlay, which pulls courthive-components.
 */
import { SET_MATCHUP_HOME_PARTICIPANT_ID } from 'constants/mutationConstants';
import { homeParticipantConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

const { EXPLICIT, NONE } = homeParticipantConstants;

export type DualHome = { homeParticipantId?: string; basis: string };

export type HomeTeamChoice = {
  participantId: string;
  participantName?: string;
  isHome: boolean;
};

export type HomeTeamMenu = {
  /** the dual's two teams, in side order */
  teams: HomeTeamChoice[];
  basis: string;
  /** an explicit home can be cleared */
  canClear: boolean;
};

type DualRef = { drawId: string; matchUpId: string };

/** The dual's home team and the basis it was decided on; `NONE` when the factory names none (or refuses). */
export function dualHome({ drawId, matchUpId }: DualRef): DualHome {
  const result: any = tournamentEngine.resolveHomeParticipantId({ drawId, matchUpId });
  if (!result || result.error) return { basis: NONE };
  return { homeParticipantId: result.homeParticipantId, basis: result.basis ?? NONE };
}

export function setHomeMethod({ drawId, matchUpId, participantId }: DualRef & { participantId: string }): any {
  return { method: SET_MATCHUP_HOME_PARTICIPANT_ID, params: { drawId, matchUpId, homeParticipantId: participantId } };
}

export function clearHomeMethod({ drawId, matchUpId }: DualRef): any {
  return { method: SET_MATCHUP_HOME_PARTICIPANT_ID, params: { drawId, matchUpId, homeParticipantId: '' } };
}

/**
 * What the dual's ⋮ "Set home team" offers: its two teams, which one is home, and whether Clear applies. `undefined`
 * until both sides have a team, because a home team can only be one of the two.
 */
export function homeTeamMenu({ drawId, matchUpId }: DualRef): HomeTeamMenu | undefined {
  const matchUp = tournamentEngine.findMatchUp({ drawId, matchUpId })?.matchUp;
  const sides = [1, 2].map((sideNumber) => matchUp?.sides?.find((side: any) => side?.sideNumber === sideNumber));
  if (matchUp?.matchUpType !== 'TEAM' || sides.some((side) => !side?.participantId)) return undefined;

  const { homeParticipantId, basis } = dualHome({ drawId, matchUpId });
  const teams = sides.map((side: any) => ({
    participantName: side.participant?.participantName,
    isHome: side.participantId === homeParticipantId,
    participantId: side.participantId,
  }));
  return { teams, basis, canClear: basis === EXPLICIT };
}
