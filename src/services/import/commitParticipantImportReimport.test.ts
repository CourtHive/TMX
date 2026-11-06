import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('services/factory/engine', async () => ({
  tournamentEngine: (await import('tods-competition-factory')).tournamentEngine,
}));
// Applies the methods to the local engine, as an acknowledged mutation would.
vi.mock('services/mutation/mutationRequest', () => ({
  mutationRequest: ({ methods, callback }: any) => callback(tournamentEngine.executionQueue(methods)),
}));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { commitParticipantImport } from './commitParticipantImport';

// columns: id, first name, last name, rating, ITF id
const mapping: any = {
  0: { kind: 'participantId' },
  1: { kind: 'firstName' },
  2: { kind: 'lastName' },
  3: { kind: 'rating', ratingScaleName: 'WTN' },
  4: { kind: 'itfId' },
};

function runImport(rows: string[][], updateExisting: boolean): Promise<any> {
  return new Promise((resolve) => {
    commitParticipantImport({
      headers: [],
      rows,
      mapping,
      dedupeKey: 'participantId',
      updateExisting,
      callback: resolve,
    });
  });
}

function imported(): any {
  const participant: any = tournamentEngine
    .getParticipants()
    .participants?.find((p: any) => p.person?.standardFamilyName === 'Rivas');
  const scaleItem: any = tournamentEngine.getParticipantScaleItem({
    participantId: participant.participantId,
    scaleAttributes: { scaleType: 'RATING', eventType: 'SINGLES', scaleName: 'WTN' },
  }).scaleItem;
  const itfIds = participant.person.personOtherIds.filter((id: any) => id.uniqueOrganisationName === 'ITF');
  return { participant, scaleItem, itfIds };
}

describe('commitParticipantImport re-import with updateExisting', () => {
  afterEach(() => tournamentEngine.reset());

  it('updates the rating and the other id of a participant already imported', async () => {
    mocksEngine.generateTournamentRecord({ setState: true });

    let result = await runImport([['row-1', 'Ana', 'Rivas', '21.5', 'ITF-1']], false);
    expect(result.success).toEqual(true);
    let state = imported();
    expect(state.scaleItem.scaleValue).toEqual({ wtnRating: 21.5 });
    expect(state.itfIds.map(({ personId }: any) => personId)).toEqual(['ITF-1']);

    result = await runImport([['row-1', 'Ana', 'Rivas', '19.25', 'ITF-2']], true);
    expect(result.success).toEqual(true);
    state = imported();
    // the newer rating is current, and the earlier one is kept as history
    expect(state.scaleItem.scaleValue).toEqual({ wtnRating: 19.25 });
    expect(state.participant.timeItems.length).toEqual(2);
    // the id is replaced in place, not duplicated
    expect(state.itfIds.map(({ personId }: any) => personId)).toEqual(['ITF-2']);

    // the same file again changes nothing
    result = await runImport([['row-1', 'Ana', 'Rivas', '19.25', 'ITF-2']], true);
    expect(result.success).toEqual(true);
    expect(imported().participant.timeItems?.length).toEqual(2);
  });
});
