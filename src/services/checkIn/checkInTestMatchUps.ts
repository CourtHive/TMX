/**
 * Hydrated matchUps for the check-in unit tests, shared so the three suites cannot drift apart.
 *
 * The shape is what `inContext` reads return and what the factory's `getMatchUpCheckInState` reads:
 * `hasContext`, a `participantId` on each side, and presence as `CHECK_IN` timeItems carrying the
 * participantId. `checkInState.test.ts` pins this shape against a matchUp the engine itself produced.
 */
const CHECK_IN = 'CHECK_IN';

function checkIns(participantIds: string[]) {
  return participantIds.map((itemValue, index) => ({
    createdAt: `2026-10-11T09:0${index}:00.000Z`,
    itemType: CHECK_IN,
    itemValue,
  }));
}

const individual = (participantId: string, participantName: string) => ({
  participantType: 'INDIVIDUAL',
  participantName,
  participantId,
});

const pair = (participantId: string, participantName: string, members: any[]) => ({
  individualParticipants: members,
  participantType: 'PAIR',
  participantName,
  participantId,
});

export const IKE = 'Ike Nkemelu';

export function singlesMatchUp(checkedInParticipantIds: string[] = []) {
  return {
    timeItems: checkIns(checkedInParticipantIds),
    hasContext: true,
    sides: [
      { sideNumber: 1, participantId: 'p1', participant: individual('p1', 'Ana Rivas') },
      { sideNumber: 2, participantId: 'p2', participant: individual('p2', 'Raj Patel') },
    ],
  };
}

export function doublesMatchUp(checkedInParticipantIds: string[] = []) {
  return {
    timeItems: checkIns(checkedInParticipantIds),
    hasContext: true,
    sides: [
      {
        sideNumber: 1,
        participantId: 'pair1',
        participant: pair('pair1', 'Rivas/Cole', [individual('p1', 'Ana Rivas'), individual('p2', 'Sam Cole')]),
      },
      {
        sideNumber: 2,
        participantId: 'pair2',
        participant: pair('pair2', 'Patel/Nkemelu', [individual('p3', 'Raj Patel'), individual('p4', IKE)]),
      },
    ],
  };
}
