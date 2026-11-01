/**
 * The notice a director gets when a draw generation leaves entries out because their stage was full, read from
 * the factory's ENTRIES_NOT_PLACED warnings on a real generation.
 */
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { getEntriesNotPlacedNotices } from './entriesNotPlaced';
import { describe, expect, it } from 'vitest';

function seedEvent({ mainCount, qualifyingCount = 0 }: { mainCount: number; qualifyingCount?: number }) {
  const {
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({
    participantsProfile: { participantsCount: 48 },
    eventProfiles: [{ eventName: 'Singles' }],
    setState: true,
  });

  const participants: any[] = tournamentEngine.getParticipants().participants ?? [];
  const participantIds = participants.map((p: any) => p.participantId);
  const mainIds = participantIds.slice(0, mainCount);
  const qualifyingIds = participantIds.slice(mainCount, mainCount + qualifyingCount);

  let result: any = tournamentEngine.addEventEntries({ participantIds: mainIds, eventId });
  expect(result.success).toEqual(true);
  if (qualifyingIds.length) {
    result = tournamentEngine.addEventEntries({ participantIds: qualifyingIds, entryStage: 'QUALIFYING', eventId });
    expect(result.success).toEqual(true);
  }

  const nameOf = (participantId: string) =>
    participants.find((p: any) => p.participantId === participantId)?.participantName;

  return { eventId, mainIds, qualifyingIds, participants, nameOf };
}

describe('getEntriesNotPlacedNotices', () => {
  it('names the 4 accepted entries a 16 draw from 20 left out', () => {
    const { eventId, mainIds, participants, nameOf } = seedEvent({ mainCount: 20 });

    const result: any = tournamentEngine.generateDrawDefinition({ eventId, drawSize: 16 });
    expect(result.success).toEqual(true);

    const notices = getEntriesNotPlacedNotices({ warnings: result.warnings, participants });
    expect(notices).toEqual([
      {
        names: mainIds.slice(16).map(nameOf),
        isQualifying: false,
        drawSize: 16,
        stage: 'MAIN',
        count: 4,
      },
    ]);
  });

  it('gives no notice for an exact fit', () => {
    const { eventId, participants } = seedEvent({ mainCount: 16 });
    const result: any = tournamentEngine.generateDrawDefinition({ eventId, drawSize: 16 });
    expect(result.success).toEqual(true);
    expect(getEntriesNotPlacedNotices({ warnings: result.warnings, participants })).toEqual([]);
  });

  it('names the qualifying entries left out when qualifying is generated into the placeholder, as the drawer does', () => {
    const { eventId, qualifyingIds, participants, nameOf } = seedEvent({ mainCount: 12, qualifyingCount: 12 });
    const entries = tournamentEngine.getEvent({ eventId }).event.entries;
    const mainEntries = entries.filter(({ entryStage }: any) => entryStage !== 'QUALIFYING');
    const qualifyingEntries = entries.filter(({ entryStage }: any) => entryStage === 'QUALIFYING');

    // the drawer's main draw with a qualifying placeholder (its drawOptions, as submitDrawParams builds them)
    const mainDrawOptions: any = {
      drawEntries: mainEntries,
      qualifyingPlaceholder: true,
      ignoreStageSpace: true,
      qualifiersCount: 4,
      drawSize: 16,
      eventId,
    };
    let result: any = tournamentEngine.generateDrawDefinition(mainDrawOptions);
    expect(result.success).toEqual(true);
    const drawId = result.drawDefinition.drawId;
    result = tournamentEngine.addDrawDefinition({ eventId, drawDefinition: result.drawDefinition });
    expect(result.success).toEqual(true);

    // the drawer's qualifying generation: 12 qualifying entries into an 8 draw
    result = tournamentEngine.generateDrawDefinition({
      qualifyingProfiles: [{ structureProfiles: [{ qualifyingPositions: 4, drawSize: 8 }] }],
      drawEntries: qualifyingEntries,
      ignoreStageSpace: true,
      drawId,
      eventId,
    });
    expect(result.success).toEqual(true);

    const notices = getEntriesNotPlacedNotices({ warnings: result.warnings, participants });
    expect(notices).toEqual([
      {
        names: qualifyingIds.slice(8).map(nameOf),
        stage: 'QUALIFYING',
        isQualifying: true,
        drawSize: 8,
        count: 4,
      },
    ]);
  });

  it('ignores other warnings and falls back to the participantId for an unknown participant', () => {
    const warnings = [
      { code: 'EVENT_DATE_INACTIVE' },
      { code: 'ENTRIES_NOT_PLACED', stage: 'MAIN', drawSize: 8, participantIds: ['unknown'] },
      { code: 'ENTRIES_NOT_PLACED', stage: 'MAIN', drawSize: 8, participantIds: [] },
    ];
    expect(getEntriesNotPlacedNotices({ warnings })).toEqual([
      { names: ['unknown'], isQualifying: false, drawSize: 8, stage: 'MAIN', count: 1 },
    ]);
  });
});
