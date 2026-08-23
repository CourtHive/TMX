/**
 * Per-matchUp check-in state.
 *
 * **Every meaningful case here is a DOUBLES case.** A singles fixture exercises none of the mechanism:
 * it has no nested individuals, so a derivation that ignored `individualParticipants` entirely would
 * pass a singles-only suite and then show an empty menu for exactly the matchUps a desk operator cares
 * about. The partial state — one of two partners present — is the reason the feature exists.
 */
import { awaitingCheckIn, getMatchUpCheckInState, checkInSummary } from './checkInState';
import { describe, expect, it } from 'vitest';

const IKE = 'Ike Nkemelu';

const singlesMatchUp = (checkedInParticipantIds: string[] = []) => ({
  checkedInParticipantIds,
  sides: [
    {
      sideNumber: 1,
      participant: { participantId: 'p1', participantName: 'Ana Rivas', participantType: 'INDIVIDUAL' },
    },
    {
      sideNumber: 2,
      participant: { participantId: 'p2', participantName: 'Raj Patel', participantType: 'INDIVIDUAL' },
    },
  ],
});

const doublesMatchUp = (checkedInParticipantIds: string[] = []) => ({
  checkedInParticipantIds,
  sides: [
    {
      sideNumber: 1,
      participant: {
        participantId: 'pair1',
        participantName: 'Rivas/Cole',
        participantType: 'PAIR',
        individualParticipants: [
          { participantId: 'p1', participantName: 'Ana Rivas' },
          { participantId: 'p2', participantName: 'Sam Cole' },
        ],
      },
    },
    {
      sideNumber: 2,
      participant: {
        participantId: 'pair2',
        participantName: 'Patel/Nkemelu',
        participantType: 'PAIR',
        individualParticipants: [
          { participantId: 'p3', participantName: 'Raj Patel' },
          { participantId: 'p4', participantName: IKE },
        ],
      },
    },
  ],
});

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
    const state = getMatchUpCheckInState({ sides: [], checkedInParticipantIds: [] });
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
    const matchUp = { checkedInParticipantIds: [], sides: [{ sideNumber: 1 }, singlesMatchUp().sides[1]] };
    expect(getMatchUpCheckInState(matchUp).participants.map((p) => p.participantId)).toEqual(['p2']);
  });
});
