import { drawDefinitionConstants, entryStatusConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  selectionHasNonDrawEntries,
  isRotatingPartnersEligible,
  getEventOnlyUngroupedEntries,
  drawHasSharedIndividuals,
  getGroupedIndividuals,
  getPairIndividualsMap,
  pairOverlapsEntries,
  buildPairMethods,
  getPairability,
  UNGROUPED_RANK,
  GROUPED_RANK,
} from './rotatingPartners';

// constants
import { ADD_DRAW_ENTRIES, ADD_EVENT_ENTRY_PAIRS } from 'constants/mutationConstants';

const { AD_HOC, SWISS, SINGLE_ELIMINATION, MAIN } = drawDefinitionConstants;
const { ALTERNATE, DIRECT_ACCEPTANCE, UNGROUPED, WITHDRAWN } = entryStatusConstants;

const participants = [
  { participantId: 'AB', participantType: 'PAIR', individualParticipantIds: ['A', 'B'] },
  { participantId: 'CD', participantType: 'PAIR', individualParticipantIds: ['C', 'D'] },
  { participantId: 'AC', participantType: 'PAIR', individualParticipantIds: ['A', 'C'] },
  { participantId: 'A', participantType: 'INDIVIDUAL' },
];
const pairIndividuals = getPairIndividualsMap(participants as any);

describe('isRotatingPartnersEligible', () => {
  it('is AD_HOC doubles only — never SWISS, never singles, never the event view', () => {
    const doubles = { eventType: 'DOUBLES' };
    expect(isRotatingPartnersEligible({ event: doubles, drawDefinition: { drawType: AD_HOC } })).toEqual(true);
    expect(isRotatingPartnersEligible({ event: doubles, drawDefinition: { drawType: SWISS } })).toEqual(false);
    expect(
      isRotatingPartnersEligible({ event: { eventType: 'SINGLES' }, drawDefinition: { drawType: AD_HOC } }),
    ).toEqual(false);
    expect(isRotatingPartnersEligible({ event: doubles, drawDefinition: undefined })).toEqual(false);
  });
});

describe('drawHasSharedIndividuals', () => {
  it('is true only when two non-withdrawn PAIR entries share an individual', () => {
    const disjoint = [{ participantId: 'AB' }, { participantId: 'CD' }];
    expect(drawHasSharedIndividuals({ drawEntries: disjoint, pairIndividuals })).toEqual(false);
    expect(drawHasSharedIndividuals({ drawEntries: [...disjoint, { participantId: 'AC' }], pairIndividuals })).toEqual(
      true,
    );
    const withdrawn = [...disjoint, { participantId: 'AC', entryStatus: WITHDRAWN }];
    expect(drawHasSharedIndividuals({ drawEntries: withdrawn, pairIndividuals })).toEqual(false);
  });
});

describe('getGroupedIndividuals', () => {
  it('lists each individual once, with every pair they are in', () => {
    const drawEntries = [
      { participantId: 'AB', entryStage: MAIN },
      { participantId: 'AC', entryStage: MAIN },
      { participantId: 'A', entryStatus: UNGROUPED }, // not a PAIR: contributes nothing
    ];
    const grouped = getGroupedIndividuals({ drawEntries, pairIndividuals });
    expect(grouped.map((g) => g.individualId)).toEqual(['A', 'B', 'C']);
    expect(grouped.find((g) => g.individualId === 'A')?.pairIds).toEqual(['AB', 'AC']);
  });
});

describe('getEventOnlyUngroupedEntries', () => {
  it('returns the event UNGROUPED entries that are not draw entries', () => {
    const eventEntries = [
      { participantId: 'X', entryStatus: UNGROUPED },
      { participantId: 'Y', entryStatus: UNGROUPED },
      { participantId: 'AB', entryStatus: DIRECT_ACCEPTANCE },
    ];
    const drawEntries = [{ participantId: 'Y', entryStatus: UNGROUPED }];
    expect(getEventOnlyUngroupedEntries({ eventEntries, drawEntries }).map((e) => e.participantId)).toEqual(['X']);
  });
});

describe('getPairability', () => {
  const eventEntries = [{ participantId: 'AB' }, { participantId: 'CD' }];
  const row = (participantId: string, _segmentRank: number, extra = {}) => ({ participantId, _segmentRank, ...extra });

  it('without the mode, pairs only two Ungrouped rows', () => {
    const args = { rotatingEnabled: false, eventEntries, pairIndividuals };
    expect(getPairability({ ...args, rows: [row('X', UNGROUPED_RANK), row('Y', UNGROUPED_RANK)] }).pairable).toEqual(
      true,
    );
    expect(getPairability({ ...args, rows: [row('A', GROUPED_RANK), row('Y', UNGROUPED_RANK)] }).reason).toEqual(
      'NOT_PAIRABLE',
    );
  });

  it('with the mode, pairs Grouped with Grouped or Ungrouped', () => {
    const args = { rotatingEnabled: true, eventEntries, pairIndividuals };
    expect(getPairability({ ...args, rows: [row('A', GROUPED_RANK), row('C', GROUPED_RANK)] }).pairable).toEqual(true);
    expect(getPairability({ ...args, rows: [row('A', GROUPED_RANK), row('X', UNGROUPED_RANK)] }).pairable).toEqual(
      true,
    );
  });

  it('refuses existing partners, one row, three rows, or an accepted row', () => {
    const args = { rotatingEnabled: true, eventEntries, pairIndividuals };
    expect(getPairability({ ...args, rows: [row('A', GROUPED_RANK), row('B', GROUPED_RANK)] }).reason).toEqual(
      'ALREADY_PARTNERS',
    );
    expect(getPairability({ ...args, rows: [row('A', GROUPED_RANK)] }).reason).toEqual('NOT_TWO');
    expect(
      getPairability({ ...args, rows: [row('A', GROUPED_RANK), row('C', GROUPED_RANK), row('X', UNGROUPED_RANK)] })
        .reason,
    ).toEqual('NOT_TWO');
    expect(getPairability({ ...args, rows: [row('AB', 0), row('C', GROUPED_RANK)] }).reason).toEqual('NOT_PAIRABLE');
  });

  it('ignores separators', () => {
    const rows = [row('A', GROUPED_RANK), { _isSeparator: true }, row('C', GROUPED_RANK)];
    expect(getPairability({ rows, rotatingEnabled: true, eventEntries, pairIndividuals }).pairable).toEqual(true);
  });
});

describe('selection predicates', () => {
  it('flags virtual and event-only rows, and overlap only for grouped rows', () => {
    expect(selectionHasNonDrawEntries([{ participantId: 'AB' }])).toEqual(false);
    expect(selectionHasNonDrawEntries([{ participantId: 'AB' }, { _grouped: true }])).toEqual(true);
    expect(selectionHasNonDrawEntries([{ _eventOnly: true }])).toEqual(true);
    expect(pairOverlapsEntries([{ _eventOnly: true }, { _segmentRank: UNGROUPED_RANK }])).toEqual(false);
    expect(pairOverlapsEntries([{ _grouped: true }, { _eventOnly: true }])).toEqual(true);
  });
});

describe('buildPairMethods', () => {
  const base = {
    participantIds: ['A', 'C'] as [string, string],
    pairParticipantId: 'NEW',
    entryStatus: DIRECT_ACCEPTANCE,
    entryStage: MAIN,
    eventId: 'E',
    drawId: 'D',
  };

  it('keeps the single call for a pair that overlaps nothing', () => {
    const methods = buildPairMethods({ ...base, overlaps: false });
    expect(methods).toHaveLength(1);
    expect(methods[0].method).toEqual(ADD_EVENT_ENTRY_PAIRS);
    expect(methods[0].params).toMatchObject({ entryStatus: DIRECT_ACCEPTANCE, drawId: 'D', uuids: ['NEW'] });
  });

  it('enters an overlapping pair into the event as ALTERNATE and the draw as chosen', () => {
    const methods = buildPairMethods({ ...base, overlaps: true });
    expect(methods.map((m) => m.method)).toEqual([ADD_EVENT_ENTRY_PAIRS, ADD_DRAW_ENTRIES]);
    expect(methods[0].params.entryStatus).toEqual(ALTERNATE);
    expect(methods[0].params.drawId).toBeUndefined();
    expect(methods[1].params).toMatchObject({ participantIds: ['NEW'], entryStatus: DIRECT_ACCEPTANCE, drawId: 'D' });
  });
});

describe('the overlapping-pair plan against the factory', () => {
  it('puts the pair in the AD_HOC draw and leaves a bracketed flight generatable', () => {
    mocksEngine.generateTournamentRecord({
      participantsProfile: { participantsCount: 8, participantType: 'INDIVIDUAL' },
      setState: true,
    });
    const ids: string[] = (
      tournamentEngine.getParticipants({ participantFilters: { participantTypes: ['INDIVIDUAL'] } }).participants ?? []
    ).map((p: any) => p.participantId);

    tournamentEngine.addEvent({ event: { eventName: 'Doubles', eventType: 'DOUBLES', eventId: 'E' } });
    let result: any = tournamentEngine.addEventEntryPairs({
      participantIdPairs: [
        [ids[0], ids[1]],
        [ids[2], ids[3]],
        [ids[4], ids[5]],
        [ids[6], ids[7]],
      ],
      entryStatus: DIRECT_ACCEPTANCE,
      eventId: 'E',
    });
    expect(result.success).toEqual(true);

    const { drawDefinition } = tournamentEngine.generateDrawDefinition({
      drawType: AD_HOC,
      automated: false,
      eventId: 'E',
      drawId: 'D',
    });
    result = tournamentEngine.addDrawDefinition({ eventId: 'E', drawDefinition });
    expect(result.success).toEqual(true);

    const methods = buildPairMethods({
      participantIds: [ids[0], ids[2]],
      pairParticipantId: 'NEW-PAIR',
      entryStatus: DIRECT_ACCEPTANCE,
      entryStage: MAIN,
      overlaps: true,
      eventId: 'E',
      drawId: 'D',
    });
    result = tournamentEngine.executionQueue(methods, true);
    expect(result.success).toEqual(true);

    const refreshed = tournamentEngine.getEvent({ drawId: 'D' });
    expect(refreshed.event.entries.find((e: any) => e.participantId === 'NEW-PAIR')?.entryStatus).toEqual(ALTERNATE);
    expect(refreshed.drawDefinition.entries.find((e: any) => e.participantId === 'NEW-PAIR')?.entryStatus).toEqual(
      DIRECT_ACCEPTANCE,
    );

    const pairIndividualsMap = getPairIndividualsMap(tournamentEngine.getParticipants().participants);
    expect(
      drawHasSharedIndividuals({ drawEntries: refreshed.drawDefinition.entries, pairIndividuals: pairIndividualsMap }),
    ).toEqual(true);

    // the event's accepted entries still share no individual, so a bracketed flight generates
    result = tournamentEngine.generateDrawDefinition({ drawType: SINGLE_ELIMINATION, eventId: 'E', drawId: 'D2' });
    expect(result.success).toEqual(true);
  });
});
