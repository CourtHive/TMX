import { getFollowActions } from './getFollowActions';
import { describe, expect, it } from 'vitest';

const MAIN = 'main-structure';
const CONS = 'cons-structure';
const drawId = 'draw-1';
const eventId = 'event-1';
const pid = 'player-1';

// A participant who lost in MAIN R1 and fed into CONSOLATION, currently sitting
// in CONSOLATION R2. Includes an unrelated player and a round-robin sub-structure
// id that is NOT a top-level structure (should be ignored).
const eventData = {
  eventInfo: { eventId },
  drawsData: [{ drawId, structures: [{ structureId: MAIN, structureName: 'Main' }, { structureId: CONS, structureName: 'Consolation' }] }],
};

const side = (participantId: string) => ({ participantId });

const matchUps = [
  { matchUpId: 'm-main-r1', drawId, structureId: MAIN, roundNumber: 1, sides: [side(pid), side('other')] },
  { matchUpId: 'm-cons-r1', drawId, structureId: CONS, roundNumber: 1, sides: [side(pid), side('other')] },
  { matchUpId: 'm-cons-r2', drawId, structureId: CONS, roundNumber: 2, sides: [side(pid), side('other')] },
  { matchUpId: 'm-rr-sub', drawId, structureId: 'rr-subgroup', roundNumber: 1, sides: [side(pid)] },
  { matchUpId: 'm-other-draw', drawId: 'draw-2', structureId: CONS, roundNumber: 3, sides: [side(pid)] },
];

describe('getFollowActions', () => {
  it('offers a follow action to each OTHER structure holding the participant', () => {
    const actions = getFollowActions({ participantId: pid, currentStructureId: MAIN, drawId, eventId, eventData, matchUps });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: 'FOLLOW_TO_STRUCTURE',
      label: 'Go to Consolation',
      payload: { eventId, drawId, structureId: CONS, participantId: pid },
    });
  });

  it('targets the participant furthest (highest round) matchUp in the target structure', () => {
    const [action] = getFollowActions({ participantId: pid, currentStructureId: MAIN, drawId, eventId, eventData, matchUps });
    expect(action.payload.matchUpId).toBe('m-cons-r2');
  });

  it('is bidirectional — from the consolation it points back to Main', () => {
    const actions = getFollowActions({ participantId: pid, currentStructureId: CONS, drawId, eventId, eventData, matchUps });
    expect(actions).toHaveLength(1);
    expect(actions[0].payload.structureId).toBe(MAIN);
    expect(actions[0].payload.matchUpId).toBe('m-main-r1');
  });

  it('ignores non-top-level structure ids (e.g. round-robin sub-groups) and other draws', () => {
    const actions = getFollowActions({ participantId: pid, currentStructureId: MAIN, drawId, eventId, eventData, matchUps });
    const structureIds = actions.map((a) => a.payload.structureId);
    expect(structureIds).not.toContain('rr-subgroup');
    expect(actions.every((a) => a.payload.matchUpId !== 'm-other-draw')).toBe(true);
  });

  it('returns nothing without a participantId or drawId', () => {
    expect(getFollowActions({ participantId: undefined, currentStructureId: MAIN, drawId, eventId, eventData, matchUps })).toEqual([]);
    expect(getFollowActions({ participantId: pid, currentStructureId: MAIN, drawId: undefined, eventId, eventData, matchUps })).toEqual([]);
  });
});
