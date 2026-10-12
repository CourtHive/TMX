/**
 * Per-matchUp check-in state.
 *
 * **Every meaningful case here is a DOUBLES case.** A singles fixture exercises none of the mechanism:
 * it has no nested individuals, so a derivation that ignored `individualParticipants` entirely would
 * pass a singles-only suite and then show an empty menu for exactly the matchUps a desk operator cares
 * about. The partial state — one of two partners present — is the reason the feature exists.
 */
import { awaitingCheckIn, getMatchUpCheckInState, checkInSummary } from './checkInState';
import { doublesMatchUp, singlesMatchUp, IKE } from './checkInTestMatchUps';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

describe('who may check in', () => {
  it('lists both players of a singles matchUp', () => {
    const state = getMatchUpCheckInState(singlesMatchUp());
    expect(state.participants.map((p) => p.participantId)).toEqual(['p1', 'p2']);
    expect(state.total).toEqual(2);
  });

  it('lists all FOUR individuals of a doubles matchUp', () => {
    // The mechanism. CA: "doubles, and both individual participants must present themselves at the
    // physical tournament desk before the matchUp is called to court."
    const state = getMatchUpCheckInState(doublesMatchUp());
    expect(state.participants.map((p) => p.participantId)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(state.total).toEqual(4);
  });

  it('NEVER offers the PAIR itself (D4c)', () => {
    // The factory would accept it — `allRelevantParticipantIds` includes `sideParticipantIds` — and
    // nothing reconciles a PAIR-level check-in with its two individual ones. Excluding it here makes
    // the wrong write unreachable from the UI rather than merely discouraged.
    const ids = getMatchUpCheckInState(doublesMatchUp()).participants.map((p) => p.participantId);
    expect(ids).not.toContain('pair1');
    expect(ids).not.toContain('pair2');
  });

  it('carries the side number so the desk can tell the pairs apart', () => {
    const state = getMatchUpCheckInState(doublesMatchUp());
    expect(state.participants.map((p) => p.sideNumber)).toEqual([1, 1, 2, 2]);
  });

  it('carries names, because a desk operator reads names and not ids', () => {
    expect(getMatchUpCheckInState(doublesMatchUp()).participants[3].participantName).toEqual(IKE);
  });
});

describe('partial state — the reason this is not a boolean', () => {
  it('reports one of two doubles partners present', () => {
    const state = getMatchUpCheckInState(doublesMatchUp(['p1']));
    expect(state.checkedInCount).toEqual(1);
    expect(state.partial).toBe(true);
    expect(state.allCheckedIn).toBe(false);
    expect(checkInSummary(state)).toEqual('1/4');
  });

  it('reports everybody present', () => {
    const state = getMatchUpCheckInState(doublesMatchUp(['p1', 'p2', 'p3', 'p4']));
    expect(state.allCheckedIn).toBe(true);
    expect(state.partial).toBe(false);
    expect(checkInSummary(state)).toEqual('4/4');
  });

  it('reports nobody present — distinct from partial', () => {
    const state = getMatchUpCheckInState(doublesMatchUp());
    expect(state.partial).toBe(false);
    expect(state.allCheckedIn).toBe(false);
    expect(checkInSummary(state)).toEqual('0/4');
  });

  it('ignores a checked-in id that is not on this matchUp', () => {
    // A stale id must not inflate the count into a false "everyone is here".
    const state = getMatchUpCheckInState(doublesMatchUp(['p1', 'someone-else']));
    expect(state.checkedInCount).toEqual(1);
    expect(state.allCheckedIn).toBe(false);
  });

  it('does NOT report allCheckedIn for a matchUp with nobody in it', () => {
    // 0 === 0 would otherwise read as "everyone present" and let the call-to-court gate pass silently.
    const state = getMatchUpCheckInState({ sides: [], hasContext: true });
    expect(state.allCheckedIn).toBe(false);
    expect(state.hasParticipants).toBe(false);
  });
});

describe('awaitingCheckIn', () => {
  it('names exactly the people a call-to-court warning must name', () => {
    const state = getMatchUpCheckInState(doublesMatchUp(['p1', 'p3']));
    expect(awaitingCheckIn(state).map((p) => p.participantName)).toEqual(['Sam Cole', IKE]);
  });

  it('is empty once everyone has presented', () => {
    expect(awaitingCheckIn(getMatchUpCheckInState(singlesMatchUp(['p1', 'p2'])))).toEqual([]);
  });
});

describe('input guards', () => {
  it('tolerates an absent matchUp, absent sides and absent checked-in list', () => {
    for (const input of [undefined, {}, { sides: null }, { sides: [{}] }] as any[]) {
      const state = getMatchUpCheckInState(input);
      expect(state.total).toEqual(0);
      expect(state.hasParticipants).toBe(false);
    }
  });

  it('skips an empty side of a partially-drawn matchUp', () => {
    const matchUp = { hasContext: true, sides: [{ sideNumber: 1 }, singlesMatchUp().sides[1]] };
    expect(getMatchUpCheckInState(matchUp).participants.map((p) => p.participantId)).toEqual(['p2']);
  });
});

describe('against a matchUp the engine produced', () => {
  it('reads a real doubles matchUp, so the shared fixtures are a shape the factory makes', () => {
    const {
      drawIds: [drawId],
    } = mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawSize: 4, eventType: 'DOUBLES' }],
      setState: true,
    });
    const { matchUps } = tournamentEngine.allTournamentMatchUps({ inContext: true });
    const matchUp: any = matchUps?.find((candidate: any) => candidate.roundNumber === 1);
    const [first] = matchUp.sides[0].participant.individualParticipantIds;

    const result = tournamentEngine.checkInParticipant({ matchUpId: matchUp.matchUpId, participantId: first, drawId });
    expect(result.success).toBe(true);

    const stored = tournamentEngine.findMatchUp({ matchUpId: matchUp.matchUpId, drawId }).matchUp;
    const state = getMatchUpCheckInState(stored);
    expect(state.total).toEqual(4);
    expect(state.partial).toBe(true);
    expect(checkInSummary(state)).toEqual('1/4');
    expect(state.participants.find((participant) => participant.checkedIn)?.participantId).toEqual(first);
  });
});
