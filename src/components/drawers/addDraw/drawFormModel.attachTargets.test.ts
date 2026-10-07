import { drawFormModel, resolveDrawFormMode } from './drawFormModel';
import { describe, expect, it } from 'vitest';

import { QUALIFIERS_COUNT, QUALIFYING_TARGET_ROUND } from 'constants/tmxConstants';
import type { QualifyingTarget } from './qualifyingTargets';

const DA = 'DIRECT_ACCEPTANCE';
const positions = (count: number, qualifiers = 0) =>
  Array.from({ length: count }, (_, i) => ({ drawPosition: i + 1, ...(i < qualifiers ? { qualifier: true } : {}) }));
const structure = { structureId: 'S1', stage: 'MAIN', stageSequence: 1, positionAssignments: positions(32, 8) };
const draw = { drawId: 'D1', structures: [structure] };
const event = {
  eventId: 'E1',
  drawDefinitions: [draw],
  entries: Array.from({ length: 10 }, (_, i) => ({ participantId: `p${i}`, entryStage: 'MAIN', entryStatus: DA })),
};

function target(overrides: Partial<QualifyingTarget>): QualifyingTarget {
  return {
    roundNumber: 1,
    drawPositionsCount: 32,
    unfilledPositionsCount: 8,
    qualifierPositionsCount: 8,
    unplacedDirectEntriesCount: 0,
    feedingStructures: [],
    promisedQualifiers: 0,
    reservedQualifiers: 0,
    structuralCapacity: 32,
    remainingCapacity: 8,
    ...overrides,
  };
}

describe('drawFormModel — ATTACH_QUALIFYING with qualifying targets', () => {
  it('without targets the ceiling is the structure size, as before', () => {
    const mode = resolveDrawFormMode({ event, drawId: 'D1', isQualifying: true, structureId: 'S1' });
    expect(mode.kind).toBe('ATTACH_QUALIFYING');
    const view = drawFormModel(mode, { [QUALIFIERS_COUNT]: 40 });
    expect(view.derivedValues.maxQualifiers).toBe(32);
    expect(view.derivedValues.qualifiersCount).toBe(32);
    expect(view.derivedValues.qualifyingTarget).toBeUndefined();
    expect(view.fieldStates[QUALIFYING_TARGET_ROUND]?.visible).toBe(false);
  });

  it("with one open round the ceiling is that round's structural capacity and no round choice is shown", () => {
    const fed = target({
      feedingStructures: [{ structureId: 'Q', structureName: 'Qualifying', qualifiersCount: 8, placeholder: false }],
      promisedQualifiers: 8,
      structuralCapacity: 24,
    });
    const mode = resolveDrawFormMode({
      qualifyingTargets: [fed],
      isQualifying: true,
      structureId: 'S1',
      drawId: 'D1',
      event,
    });
    const view = drawFormModel(mode, { [QUALIFIERS_COUNT]: 40 });
    expect(view.derivedValues.maxQualifiers).toBe(24);
    expect(view.derivedValues.qualifiersCount).toBe(24);
    expect(view.derivedValues.qualifyingTarget).toBe(fed);
    expect(view.fieldStates[QUALIFYING_TARGET_ROUND]).toEqual({ visible: false, disabled: false, value: 1 });
  });

  it('with several open rounds the chosen round bounds the count; a full round is not offered', () => {
    const r1 = target({ roundNumber: 1, structuralCapacity: 8 });
    const r2 = target({ roundNumber: 2, drawPositionsCount: 4, structuralCapacity: 4 });
    const r3 = target({ roundNumber: 3, drawPositionsCount: 2, structuralCapacity: 0 });
    const mode = resolveDrawFormMode({
      qualifyingTargets: [r1, r2, r3],
      isQualifying: true,
      structureId: 'S1',
      drawId: 'D1',
      event,
    });
    let view = drawFormModel(mode, {});
    expect(view.derivedValues.qualifyingTargets?.map((x) => x.roundNumber)).toEqual([1, 2]);
    expect(view.fieldStates[QUALIFYING_TARGET_ROUND]).toEqual({ visible: true, disabled: false, value: 1 });
    expect(view.derivedValues.maxQualifiers).toBe(8);

    view = drawFormModel(mode, { [QUALIFYING_TARGET_ROUND]: '2', [QUALIFIERS_COUNT]: 6 });
    expect(view.derivedValues.qualifyingTarget).toBe(r2);
    expect(view.derivedValues.maxQualifiers).toBe(4);
    expect(view.derivedValues.qualifiersCount).toBe(4);
  });

  it('an explicit maxQualifiers on the mode still wins', () => {
    const mode = {
      ...resolveDrawFormMode({
        qualifyingTargets: [target({ structuralCapacity: 24 })],
        isQualifying: true,
        structureId: 'S1',
        drawId: 'D1',
        event,
      }),
      maxQualifiers: 5,
    } as any;
    const view = drawFormModel(mode, { [QUALIFIERS_COUNT]: 9 });
    expect(view.derivedValues.maxQualifiers).toBe(5);
    expect(view.derivedValues.qualifiersCount).toBe(5);
  });
});
