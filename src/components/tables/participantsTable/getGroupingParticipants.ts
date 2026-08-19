import { participantConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

const { GROUP, TEAM } = participantConstants;

/**
 * The TEAMs and GROUPs available as targets for "Add to team" / "Add to group".
 *
 * Fetched by participant TYPE, deliberately never by role, and deliberately as its own query rather than
 * being sieved out of the participants table's role-filtered result.
 *
 * `filterParticipants` applies `participantRoles` to every participant regardless of type, and a grouping
 * carries a role of its own: TEAM is pinned to COMPETITOR, and a GROUP defaults to OTHER. So deriving
 * these lists from a role-filtered query silently emptied them —
 *
 *   competitor view `[COMPETITOR]`  ->  0 GROUPs   (a GROUP is OTHER, not COMPETITOR)
 *   officials view  `[OFFICIAL]`    ->  0 GROUPs, 0 TEAMs
 *   staff view      `[15 roles]`    ->  worked only by accident: OTHER sits in STAFF_ROLES
 *
 * — which is why the "Add to group" control rendered an empty menu in the very view a TD would use it
 * from, and why it looked as though groups could not be populated at all.
 */
export function getGroupingParticipants(): { groupParticipants: any[]; teamParticipants: any[] } {
  const { participants = [] } = tournamentEngine.getParticipants({
    participantFilters: { participantTypes: [TEAM, GROUP] },
    withIndividualParticipants: true,
  });

  return {
    groupParticipants: participants.filter(({ participantType }: any) => participantType === GROUP),
    teamParticipants: participants.filter(({ participantType }: any) => participantType === TEAM),
  };
}
