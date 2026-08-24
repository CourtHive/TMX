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

  describe('onlyWhenPartial — the drag-to-strip gesture', () => {
    it('stays silent when nobody has checked in', () => {
      // The 9am case, and the whole-week case at a tournament not using check-in. A prompt here
      // fires on EVERY drop, which is the reflexive dismissal D4d exists to avoid.
      expect(callToCourtPrompt(doublesMatchUp([]), { onlyWhenPartial: true })).toBeNull();
    });

    it('still warns on a partial — somebody is here and somebody is not', () => {
      expect(callToCourtPrompt(doublesMatchUp(['p1']), { onlyWhenPartial: true })?.awaitingCount).toBe(3);
    });

    it('stays silent when everyone has checked in', () => {
      expect(callToCourtPrompt(doublesMatchUp(['p1', 'p2', 'p3', 'p4']), { onlyWhenPartial: true })).toBeNull();
    });

    it('differs from the default ONLY at zero', () => {
      // The control: if this passed with the option ignored, the option would be untested.
      expect(callToCourtPrompt(doublesMatchUp([]))?.awaitingCount).toBe(4);
      expect(callToCourtPrompt(doublesMatchUp([]), { onlyWhenPartial: true })).toBeNull();
    });
  });

  it('does not warn for a matchUp with no participants', () => {
    // An unfilled draw position: nobody COULD check in, so there is nothing to warn about.
    expect(callToCourtPrompt({ sides: [] })).toBeNull();
    expect(callToCourtPrompt(undefined)).toBeNull();
  });
});
