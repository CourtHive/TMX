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
// the legacy time item a set home was once stored as; the factory's `timeItemConstants` object does not carry it
const HOME_PARTICIPANT_ID = 'HOME_PARTICIPANT_ID';

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

/**
 * The home team the venue or host organisation would give the dual with no home team set, so the scorecard can show
 * it in place of a set home being cleared. Empty when the home team is not set, or when nothing would be inferred.
 */
export function inferredHome({ drawId, matchUpId }: DualRef): {
  inferredParticipantId?: string;
  inferredBasis?: string;
} {
  const matchUp: any = tournamentEngine.findMatchUp({ drawId, matchUpId, inContext: true })?.matchUp;
  if (!matchUp) return {};
  // the same dual with its set home taken out: the first-class value and the legacy time item both
  const unset = {
    ...matchUp,
    hasContext: true,
    schedule: { ...matchUp.schedule, homeParticipantId: undefined },
    timeItems: (matchUp.timeItems ?? []).filter((item: any) => item?.itemType !== HOME_PARTICIPANT_ID),
  };
  const result: any = tournamentEngine.resolveHomeParticipantId({ drawId, matchUpId, matchUp: unset });
  if (!result || result.error || !result.homeParticipantId || [EXPLICIT, NONE].includes(result.basis)) return {};
  return { inferredParticipantId: result.homeParticipantId, inferredBasis: result.basis };
}

type SaveHomeParams = {
  send: (params: { methods: any[]; callback: (result: any) => void }) => Promise<void> | void;
  methods: any[];
  onRefresh?: () => void;
};

/**
 * Send a home team change and resolve to whether it was accepted. The scorecard keeps its edit open with the choice when
 * this resolves false, so a refusal refreshes nothing.
 */
export function saveHomeTeam({ send, methods, onRefresh }: SaveHomeParams): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const settle = (success: boolean) => {
      if (success) onRefresh?.();
      resolve(success);
    };
    try {
      // every path through the mutation calls back; a throw is settled here so the card never waits forever
      Promise.resolve(send({ methods, callback: (result: any) => settle(!!result?.success) })).catch(() =>
        settle(false),
      );
    } catch {
      settle(false);
    }
  });
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
