import { tournamentEngine, mocksEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

import { signedInOnDate, stillSignedInOnDate } from './signInPresence';

/**
 * The reader against a record written by the CURRENT factory.
 *
 * `signInPresence` was written when sign-in lived in `participant.timeItems` as `SIGN_IN_STATUS`.
 * CODES 7.0.0 promotes it to `participant.presence[]` and NATIVE mode writes no timeItem at all, so a
 * reader walking `timeItems` sees an empty history and reports everybody absent — silently, and on the
 * one surface whose entire job is answering "is this person here today".
 *
 * These specs pin the reader to the factory's actual output rather than to a hand-built fixture. A
 * fixture of the old shape would keep passing through exactly the change that breaks the feature,
 * which is what makes `signInPresence.test.ts`'s hand-built participants insufficient on their own.
 */
const DATE = '2026-09-18';

function seededParticipants() {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    participantsProfile: { participantsCount: 3 },
  });
  // UTC so the venue-day resolution is unambiguous in the assertion
  tournamentRecord.localTimeZone = 'UTC';
  tournamentEngine.setState(tournamentRecord, false);

  const [a, b] = tournamentRecord.participants.map((p: any) => p.participantId);

  tournamentEngine.modifyParticipantsSignInStatus({
    occurredAt: `${DATE}T13:00:00.000Z`,
    participantIds: [a, b],
    signInState: 'SIGNED_IN',
  });
  tournamentEngine.modifyParticipantsSignInStatus({
    occurredAt: `${DATE}T18:00:00.000Z`,
    signInState: 'SIGNED_OUT',
    participantIds: [b],
  });

  const { participants } = tournamentEngine.getParticipants({});
  return { participants: participants ?? [], a, b };
}

describe('signInPresence against factory-written records', () => {
  it('reports who was present on the date', () => {
    const { participants, a } = seededParticipants();
    const present = participants.find((p: any) => p.participantId === a);

    expect(signedInOnDate(present, DATE)).toEqual(true);
  });

  it('reports somebody who signed out as NOT present', () => {
    const { participants, b } = seededParticipants();
    const departed = participants.find((p: any) => p.participantId === b);

    // signed in at 13:00 and out at 18:00 — the last action of the day was leaving
    expect(signedInOnDate(departed, DATE)).toEqual(false);
  });

  it('lists exactly those still signed in, for the end-of-day close', () => {
    const { participants, a } = seededParticipants();

    expect(stillSignedInOnDate(participants, DATE)).toEqual([a]);
  });

  it('reports nobody present on a day with no entries', () => {
    const { participants } = seededParticipants();

    // a day with no entry means "not signed in on this date", never "signed out"
    expect(stillSignedInOnDate(participants, '2026-09-16')).toEqual([]);
  });
});
