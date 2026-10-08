import { describe, expect, it } from 'vitest';
import {
  clampToTarget,
  feedersOf,
  selectTarget,
  targetNotice,
  targetOptionLabel,
  targetsWithCapacity,
} from './qualifyingTargets';

import type { QualifyingTarget } from './qualifyingTargets';

const t = (key: string, values: Record<string, unknown> = {}) =>
  `${key.split('.').pop()}:${Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join(',')}`;

function target(overrides: Partial<QualifyingTarget>): QualifyingTarget {
  return {
    roundNumber: 1,
    drawPositionsCount: 32,
    unfilledPositionsCount: 32,
    qualifierPositionsCount: 0,
    unplacedDirectEntriesCount: 0,
    feedingStructures: [],
    promisedQualifiers: 0,
    reservedQualifiers: 0,
    structuralCapacity: 32,
    remainingCapacity: 32,
    ...overrides,
  };
}

describe('qualifyingTargets', () => {
  it('keeps only rounds with structural capacity', () => {
    const open = target({ roundNumber: 1, structuralCapacity: 8 });
    const full = target({ roundNumber: 2, structuralCapacity: 0 });
    expect(targetsWithCapacity([full, open])).toEqual([open]);
    expect(targetsWithCapacity(undefined)).toEqual([]);
  });

  it('selects the requested round, or the first open one when the request is absent or unknown', () => {
    const r1 = target({ roundNumber: 1 });
    const r3 = target({ roundNumber: 3 });
    expect(selectTarget([r1, r3], '3')).toBe(r3);
    expect(selectTarget([r1, r3], 3)).toBe(r3);
    expect(selectTarget([r1, r3], undefined)).toBe(r1);
    expect(selectTarget([r1, r3], '9')).toBe(r1);
    expect(selectTarget([], 1)).toBeUndefined();
  });

  it('clamps the qualifiers count into [1, structuralCapacity]', () => {
    const r1 = target({ structuralCapacity: 24 });
    expect(clampToTarget(40, r1)).toBe(24);
    expect(clampToTarget(0, r1)).toBe(1);
    expect(clampToTarget(Number.NaN, r1)).toBe(1);
    expect(clampToTarget(8, r1)).toBe(8);
    expect(clampToTarget(8, undefined)).toBe(8);
  });

  it('describes a round nobody feeds yet, and one already fed, without counting placeholders as feeders', () => {
    const empty = target({ roundNumber: 1, drawPositionsCount: 64, structuralCapacity: 64 });
    expect(targetNotice(empty, t)).toBe('noFeeders:round=1 targetCapacity:open=64,total=64,round=1');

    const fed = target({
      feedingStructures: [
        { structureId: 'q', structureName: 'Qualifying', qualifiersCount: 16, placeholder: false },
        { structureId: 'p', structureName: undefined, qualifiersCount: 4, placeholder: true },
      ],
      drawPositionsCount: 64,
      promisedQualifiers: 16,
      structuralCapacity: 48,
    });
    expect(feedersOf(fed).map((f) => f.structureId)).toEqual(['q']);
    expect(targetNotice(fed, t)).toBe(
      'alreadyFed:round=1,feederNames=Qualifying (16),count=16 targetCapacity:open=48,total=64,round=1',
    );
    expect(targetOptionLabel(fed, t)).toBe('targetRoundOption:total=64,open=48,round=1');
  });
});
