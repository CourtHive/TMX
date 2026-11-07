import { insufficientPositions } from './insufficientPositions';
import { describe, expect, it } from 'vitest';

const entries = (count: number, extra: Record<string, string> = {}) =>
  Array.from({ length: count }, (_, i) => ({ participantId: `p${i}`, entryStatus: 'DIRECT_ACCEPTANCE', ...extra }));

describe('insufficientPositions — what a refused generation means', () => {
  it('26 accepted entries for a 16 draw: 10 over', () => {
    expect(insufficientPositions({ drawSize: 16, drawEntries: entries(26) })).toEqual({
      entries: 26,
      places: 16,
      over: 10,
    });
  });

  it('holds back the qualifier slots', () => {
    const drawOptions = {
      drawSize: 32,
      drawEntries: entries(30),
      qualifyingProfiles: [{ structureProfiles: [{ drawSize: 16, qualifyingPositions: 4 }] }],
    };
    expect(insufficientPositions(drawOptions)).toEqual({ entries: 30, places: 28, over: 2 });
  });

  it('counts only the entries that take a place in the main draw', () => {
    const drawEntries = [
      ...entries(16),
      ...entries(5, { entryStatus: 'ALTERNATE' }),
      ...entries(3, { entryStatus: 'WITHDRAWN' }),
      ...entries(8, { entryStage: 'QUALIFYING' }),
    ];
    expect(insufficientPositions({ drawSize: 16, drawEntries })).toBeUndefined();
  });

  it('says nothing it cannot count', () => {
    expect(insufficientPositions({ drawEntries: entries(20) })).toBeUndefined();
    expect(insufficientPositions({ drawSize: 16 })).toBeUndefined();
  });

  it('the factory refuses exactly this case, with the code generateDraw reads', async () => {
    const { mocksEngine, tournamentEngine } = await import('tods-competition-factory');
    const {
      eventIds: [eventId],
    } = mocksEngine.generateTournamentRecord({
      participantsProfile: { participantsCount: 26 },
      eventProfiles: [{ eventName: 'E', participantsProfile: { participantsCount: 26 } }],
      setState: true,
    });
    const { event } = tournamentEngine.getEvent({ eventId });
    const drawOptions = { eventId, drawSize: 16, drawEntries: event.entries };
    const result: any = tournamentEngine.generateDrawDefinition({ ...drawOptions, ignoreStageSpace: true });
    expect(result.error?.code).toBe('ERR_INSUFFICIENT_DRAW_POSITIONS');
    expect(insufficientPositions(drawOptions)).toEqual({ entries: 26, places: 16, over: 10 });
  });
});
