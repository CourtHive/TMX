/**
 * Grouping lookup for the "Add to team" / "Add to group" menus.
 *
 * These lists used to be sieved out of the participants table's ROLE-filtered query. Because
 * `filterParticipants` applies `participantRoles` to groupings too — and a GROUP carries OTHER while a
 * TEAM carries COMPETITOR — the competitor view saw zero GROUPs and the officials view saw neither
 * GROUPs nor TEAMs. The menus rendered empty, which is why it appeared impossible to add anyone to a
 * group. Measured against the engine before the fix:
 *
 *   INDIVIDUAL view [COMPETITOR] -> GROUPs visible: 0
 *   OFFICIAL   view [OFFICIAL]   -> GROUPs visible: 0
 *   STAFF      view [15 roles]   -> GROUPs visible: 1   (accident: OTHER is in STAFF_ROLES)
 *   no filter                    -> GROUPs visible: 1   (control)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getParticipantsMock } = vi.hoisted(() => ({ getParticipantsMock: vi.fn() }));
vi.mock('services/factory/engine', () => ({ tournamentEngine: { getParticipants: getParticipantsMock } }));

import { getGroupingParticipants } from './getGroupingParticipants';
import { participantRoles } from 'tods-competition-factory';

const { COACH, COMPETITOR, OTHER } = participantRoles;

const TEAM_ALPHA = { participantId: 't1', participantType: 'TEAM', participantRole: COMPETITOR };
const GROUP_NEUTRAL = { participantId: 'g1', participantType: 'GROUP', participantRole: OTHER };
const GROUP_COACH = { participantId: 'g2', participantType: 'GROUP', participantRole: COACH };

beforeEach(() => getParticipantsMock.mockReset());
afterEach(() => vi.clearAllMocks());

describe('getGroupingParticipants', () => {
  it('queries by participantType and never by participantRole', () => {
    // The whole point. A role filter here re-creates the empty-menu bug, because a grouping's own role
    // is unrelated to the role of the view the menu is rendered in.
    getParticipantsMock.mockReturnValue({ participants: [] });
    getGroupingParticipants();

    const { participantFilters } = getParticipantsMock.mock.calls.at(-1)?.[0] ?? {};
    expect(participantFilters.participantTypes).toEqual(expect.arrayContaining(['TEAM', 'GROUP']));
    expect(participantFilters.participantRoles).toBeUndefined();
  });

  it('returns groups whose role is OTHER — the default, and the one a COMPETITOR filter dropped', () => {
    getParticipantsMock.mockReturnValue({ participants: [TEAM_ALPHA, GROUP_NEUTRAL, GROUP_COACH] });
    const { groupParticipants } = getGroupingParticipants();
    expect(groupParticipants.map((p: any) => p.participantId)).toEqual(['g1', 'g2']);
  });

  it('partitions teams and groups', () => {
    getParticipantsMock.mockReturnValue({ participants: [TEAM_ALPHA, GROUP_NEUTRAL, GROUP_COACH] });
    const { groupParticipants, teamParticipants } = getGroupingParticipants();
    expect(teamParticipants.map((p: any) => p.participantId)).toEqual(['t1']);
    expect(groupParticipants).toHaveLength(2);
  });

  it('hydrates members, so a picker can exclude people already in the grouping', () => {
    getParticipantsMock.mockReturnValue({ participants: [] });
    getGroupingParticipants();
    expect(getParticipantsMock.mock.calls.at(-1)?.[0]?.withIndividualParticipants).toBe(true);
  });

  it('tolerates an engine that returns no participants key', () => {
    getParticipantsMock.mockReturnValue({});
    expect(getGroupingParticipants()).toEqual({ groupParticipants: [], teamParticipants: [] });
  });
});
