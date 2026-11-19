import { gridMinutesByCourt } from './gridMinutesByCourt';
import { describe, expect, it } from 'vitest';

const onGrid = (courtId: string, courtOrder: number, matchUpFormat = 'SET3-S:6/TB7') => ({
  schedule: { courtId, courtOrder, scheduledDate: '2026-12-05' },
  matchUpFormat,
});
const ninety = (matchUp: any) => (matchUp.matchUpFormat ? 90 : undefined);

describe('gridMinutesByCourt', () => {
  it('adds each grid matchUp’s average to its court', () => {
    const minutes = gridMinutesByCourt([onGrid('c1', 1), onGrid('c1', 2), onGrid('c3', 1)], ninety);
    expect(Object.fromEntries(minutes)).toEqual({ c1: 180, c3: 90 });
  });

  it('skips a court suggestion: a courtId with no grid row', () => {
    const suggestion = { schedule: { courtId: 'c4', scheduledDate: '2026-12-05' }, matchUpFormat: 'SET3-S:6/TB7' };
    expect(gridMinutesByCourt([suggestion], ninety).size).toBe(0);
  });

  it('skips a grid matchUp with no average to give', () => {
    const noFormat = { schedule: { courtId: 'c1', courtOrder: 1 } };
    expect(gridMinutesByCourt([noFormat, onGrid('c1', 2)], ninety).get('c1')).toBe(90);
  });

  it('ignores matchUps with no schedule at all', () => {
    expect(gridMinutesByCourt([{}, { schedule: {} }, undefined], ninety).size).toBe(0);
  });
});
