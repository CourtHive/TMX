/**
 * The call-to-court warning decision (D4d).
 *
 * DOUBLES throughout: the case that matters is one partner of a pair still absent, and a singles
 * fixture cannot express it. A suite built on singles would pass against an implementation that
 * ignored `individualParticipants` entirely — which is the exact mechanism under test.
 */
import { callToCourtPrompt } from './callToCourtPrompt';
import { describe, expect, it } from 'vitest';

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
          { participantId: 'p4', participantName: 'Ike Nkemelu' },
        ],
      },
    },
  ],
});

describe('callToCourtPrompt', () => {
  it('names exactly the participants who are missing', () => {
    const prompt = callToCourtPrompt(doublesMatchUp(['p1', 'p3']));
    expect(prompt?.awaitingCount).toBe(2);
    expect(prompt?.names).toBe('Sam Cole, Ike Nkemelu');
  });

  it('warns when one partner of a pair is absent', () => {
    // The state the desk actually manages — and the one a boolean would collapse.
    expect(callToCourtPrompt(doublesMatchUp(['p1', 'p2', 'p3']))?.awaitingCount).toBe(1);
  });

  it('does not warn when everyone has checked in', () => {
    expect(callToCourtPrompt(doublesMatchUp(['p1', 'p2', 'p3', 'p4']))).toBeNull();
  });

  it('warns when nobody has checked in', () => {
    // Distinct from the badge, which stays silent at 0 to avoid painting the whole catalog.
    // At the moment of calling, "nobody is here" is precisely what the operator must be told.
    expect(callToCourtPrompt(doublesMatchUp([]))?.awaitingCount).toBe(4);
  });

  it('does not warn for a matchUp with no participants', () => {
    // An unfilled draw position: nobody COULD check in, so there is nothing to warn about.
    expect(callToCourtPrompt({ sides: [] })).toBeNull();
    expect(callToCourtPrompt(undefined)).toBeNull();
  });
});
