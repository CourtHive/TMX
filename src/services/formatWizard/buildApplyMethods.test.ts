import { buildApplyMethods, structureKindToDrawSpec } from './buildApplyMethods';
import { expect, it, describe } from 'vitest';

// constants and types
import { ADD_EVENT, ADD_EVENT_ENTRIES } from 'constants/mutationConstants';
import { FlightStructure, RankedPlan, StructureKind } from 'tods-competition-factory';

let uuidCounter = 0;
const deterministicUuid = (): string => `id-${++uuidCounter}`;

function makeFlightStructure(
  label: string,
  participantIds: string[],
  kind: StructureKind,
  extras: Partial<FlightStructure['structure']> = {},
): FlightStructure {
  const ratings = participantIds.map((_, i) => 4 + i * 0.1);
  return {
    flight: { label, participantIds, ratings },
    structure: {
      kind,
      minMatchesPerPlayer: 1,
      effectiveMinMatchesPerPlayer: 1,
      withdrawalRiskFactor: 0,
      totalMatches: participantIds.length - 1,
      ...extras,
    },
    predictedBands: { competitive: 0.6, decisive: 0.2, routine: 0.2 },
  };
}

function makePlan(flights: FlightStructure[], strategy: RankedPlan['strategy'] = 'EQUAL_COUNT'): RankedPlan {
  return {
    rank: 1,
    score: 0.7,
    strategy,
    flightStructures: flights,
    aggregate: {
      effectiveMinMatchesPerPlayer: 1,
      minMatchesPerPlayer: 1,
      courtHoursAvailable: 64,
      courtHoursRequired: 16,
      courtUtilization: 0.25,
      totalMatches: 16,
      competitive: 0.6,
      decisive: 0.2,
      routine: 0.2,
    },
    warnings: [],
  };
}

describe('structureKindToDrawSpec', () => {
  it('passes SE / FMLC / FRLC / DE / Compass / Lucky / Adaptive through unchanged', () => {
    const passthrough: StructureKind[] = [
      'SINGLE_ELIMINATION',
      'FIRST_MATCH_LOSER_CONSOLATION',
      'FIRST_ROUND_LOSER_CONSOLATION',
      'DOUBLE_ELIMINATION',
      'COMPASS',
      'LUCKY_DRAW',
      'ADAPTIVE',
    ];
    for (const kind of passthrough) {
      const spec = structureKindToDrawSpec({
        kind,
        minMatchesPerPlayer: 1,
        effectiveMinMatchesPerPlayer: 1,
        withdrawalRiskFactor: 0,
        totalMatches: 7,
      });
      expect(spec?.drawType).toEqual(kind);
    }
  });

  it('attaches groupSize for ROUND_ROBIN / ROUND_ROBIN_WITH_PLAYOFF', () => {
    const spec = structureKindToDrawSpec({
      kind: 'ROUND_ROBIN',
      minMatchesPerPlayer: 3,
      effectiveMinMatchesPerPlayer: 3,
      withdrawalRiskFactor: 0,
      totalMatches: 6,
      groupSize: 4,
    });
    expect(spec?.drawType).toEqual('ROUND_ROBIN');
    expect(spec?.extras.groupSize).toEqual(4);
  });

  it('attaches roundsCount for SWISS', () => {
    const spec = structureKindToDrawSpec({
      kind: 'SWISS',
      minMatchesPerPlayer: 5,
      effectiveMinMatchesPerPlayer: 5,
      withdrawalRiskFactor: 0,
      totalMatches: 40,
      rounds: 5,
    });
    expect(spec?.drawType).toEqual('SWISS');
    expect(spec?.extras.roundsCount).toEqual(5);
  });

  it('translates DRAW_MATIC to AD_HOC with drawMatic config', () => {
    const spec = structureKindToDrawSpec({
      kind: 'DRAW_MATIC',
      minMatchesPerPlayer: 5,
      effectiveMinMatchesPerPlayer: 5,
      withdrawalRiskFactor: 0.1,
      totalMatches: 40,
      rounds: 5,
    });
    expect(spec?.drawType).toEqual('AD_HOC');
    expect((spec?.extras.drawMatic as any).roundsCount).toEqual(5);
  });

  it('returns null for STAGGERED_FRENCH (unsupported in MVP)', () => {
    expect(
      structureKindToDrawSpec({
        kind: 'STAGGERED_FRENCH',
        minMatchesPerPlayer: 1,
        effectiveMinMatchesPerPlayer: 1,
        withdrawalRiskFactor: 0.1,
        totalMatches: 15,
      }),
    ).toBeNull();
  });
});

describe('buildApplyMethods — output shape', () => {
  it('emits ADD_EVENT and ADD_EVENT_ENTRIES per flight', () => {
    uuidCounter = 0;
    const plan = makePlan([
      makeFlightStructure('Tier 1 of 2', ['p0', 'p1', 'p2', 'p3'], 'SINGLE_ELIMINATION'),
      makeFlightStructure('Tier 2 of 2', ['p4', 'p5', 'p6', 'p7'], 'SINGLE_ELIMINATION'),
    ]);
    const result = buildApplyMethods({ plan, scaleName: 'utr', uuid: deterministicUuid });

    const eventMethodNames = result.eventMethods.map((m) => m.method);
    expect(eventMethodNames).toEqual([ADD_EVENT, ADD_EVENT_ENTRIES, ADD_EVENT, ADD_EVENT_ENTRIES]);
    expect(result.eventCount).toEqual(2);
    expect(result.participantCount).toEqual(8);
  });

  it('encodes the rating scale into the event name', () => {
    uuidCounter = 0;
    const plan = makePlan([makeFlightStructure('Tier 1 of 2', ['p0', 'p1'], 'SINGLE_ELIMINATION')]);
    const result = buildApplyMethods({ plan, scaleName: 'utr', uuid: deterministicUuid });

    const addEvent = result.eventMethods.find((m) => m.method === ADD_EVENT);
    expect(addEvent.params.event.eventName).toContain('UTR');
    expect(addEvent.params.event.eventName).toContain('Tier 1 of 2');
  });

  it('honors eventNamePrefix when supplied', () => {
    const plan = makePlan([makeFlightStructure('Cluster 1 of 2', ['p0', 'p1'], 'ROUND_ROBIN', { groupSize: 2 })]);
    const result = buildApplyMethods({ plan, scaleName: 'wtn', eventNamePrefix: 'Sunday Open' });

    const addEvent = result.eventMethods.find((m) => m.method === ADD_EVENT);
    expect(addEvent.params.event.eventName.startsWith('Sunday Open')).toBe(true);
  });

  it('generates one drawSpec per applied flight, with eventId/drawId pairing', () => {
    uuidCounter = 0;
    const plan = makePlan([
      makeFlightStructure('Tier 1 of 2', ['p0', 'p1', 'p2', 'p3'], 'SINGLE_ELIMINATION'),
      makeFlightStructure('Tier 2 of 2', ['p4', 'p5', 'p6', 'p7'], 'ROUND_ROBIN', { groupSize: 4 }),
    ]);
    const result = buildApplyMethods({ plan, uuid: deterministicUuid });

    expect(result.drawSpecs).toHaveLength(2);
    expect(result.drawSpecs[0].drawType).toEqual('SINGLE_ELIMINATION');
    expect(result.drawSpecs[0].drawSize).toEqual(4);
    expect(result.drawSpecs[1].drawType).toEqual('ROUND_ROBIN');
    expect(result.drawSpecs[1].extras.groupSize).toEqual(4);
    // eventIds in drawSpecs match the eventIds in the ADD_EVENT methods
    const eventIds = result.eventMethods
      .filter((m) => m.method === ADD_EVENT)
      .map((m) => m.params.event.eventId);
    const specIds = result.drawSpecs.map((s) => s.eventId);
    expect(specIds).toEqual(eventIds);
  });

  it('rounds non-power-of-two SE flight sizes up to next power of two', () => {
    const plan = makePlan([
      makeFlightStructure('Tier 1', ['p0', 'p1', 'p2', 'p3', 'p4'], 'SINGLE_ELIMINATION'),
    ]);
    const result = buildApplyMethods({ plan });
    expect(result.drawSpecs[0].drawSize).toEqual(8);
  });

  it('reports STAGGERED_FRENCH flights as unsupported instead of emitting methods', () => {
    const plan = makePlan([
      makeFlightStructure('Open', ['p0', 'p1', 'p2', 'p3'], 'STAGGERED_FRENCH'),
      makeFlightStructure('Backdraw', ['p4', 'p5'], 'SINGLE_ELIMINATION'),
    ]);
    const result = buildApplyMethods({ plan });
    expect(result.unsupported).toHaveLength(1);
    expect(result.unsupported[0].kind).toEqual('STAGGERED_FRENCH');
    expect(result.eventCount).toEqual(1);
    expect(result.drawSpecs).toHaveLength(1);
  });

  it('skips flights with zero participants without erroring', () => {
    const plan = makePlan([makeFlightStructure('Empty', [], 'SINGLE_ELIMINATION')]);
    const result = buildApplyMethods({ plan });
    expect(result.eventCount).toEqual(0);
    expect(result.eventMethods).toHaveLength(0);
  });

  it('passes participantIds through unchanged on ADD_EVENT_ENTRIES', () => {
    const plan = makePlan([makeFlightStructure('Tier 1', ['p0', 'p1', 'p2', 'p3'], 'SINGLE_ELIMINATION')]);
    const result = buildApplyMethods({ plan });
    const addEntries = result.eventMethods.find((m) => m.method === ADD_EVENT_ENTRIES);
    expect(addEntries.params.participantIds).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(addEntries.params.entryStage).toEqual('MAIN');
  });
});
