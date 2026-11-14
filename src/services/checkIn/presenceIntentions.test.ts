import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { presenceIntentionsHeld } from './presenceIntentions';
import { describe, expect, it } from 'vitest';

function seed() {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 4 }] });
  tournamentEngine.setState(tournamentRecord);
  const matchUp: any = tournamentEngine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] } }).matchUps?.[0];
  return { matchUpId: matchUp.matchUpId, drawId: matchUp.drawId, participantId: matchUp.sides[0].participantId };
}

const intention = (ids: Record<string, string>, checkedIn: boolean) => ({
  method: 'setParticipantCheckInState',
  params: { ...ids, checkedIn },
});

describe('presenceIntentionsHeld', () => {
  it('holds when the requested state matches this copy, in either direction', () => {
    const ids = seed();
    expect(presenceIntentionsHeld(tournamentEngine, [intention(ids, false)])).toBe(true);
    expect(presenceIntentionsHeld(tournamentEngine, [intention(ids, true)])).toBe(false);

    tournamentEngine.setParticipantCheckInState({ ...ids, checkedIn: true });
    expect(presenceIntentionsHeld(tournamentEngine, [intention(ids, true)])).toBe(true);
    expect(presenceIntentionsHeld(tournamentEngine, [intention(ids, false)])).toBe(false);
  });

  it('judges only the last intention for a person in a matchUp', () => {
    const ids = seed();
    expect(presenceIntentionsHeld(tournamentEngine, [intention(ids, true), intention(ids, false)])).toBe(true);
  });

  it('ignores every other method', () => {
    seed();
    expect(presenceIntentionsHeld(tournamentEngine, [{ method: 'toggleParticipantCheckInState', params: {} }])).toBe(
      true,
    );
    expect(presenceIntentionsHeld(tournamentEngine, undefined)).toBe(true);
  });

  // An intention this copy cannot judge is treated as unmet: a refresh costs one fetch, a fabricated state costs trust.
  it('is unmet for a person or matchUp this copy does not know', () => {
    const ids = seed();
    expect(presenceIntentionsHeld(tournamentEngine, [intention({ ...ids, participantId: 'nobody' }, false)])).toBe(
      false,
    );
    expect(presenceIntentionsHeld(tournamentEngine, [intention({ ...ids, matchUpId: 'missing' }, false)])).toBe(false);
  });
});
