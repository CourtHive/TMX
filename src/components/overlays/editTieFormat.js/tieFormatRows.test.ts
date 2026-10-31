import {
  collectionFromRow,
  lineValuesTotal,
  resizeLineValues,
  rowFromCollection,
  seedLineValues,
} from './tieFormatRows';
import { COLLECTION_VALUE, LINE_VALUES, MATCH_VALUE } from 'constants/tmxConstants';
import { scoreGovernor, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

const mintId = () => 'minted';

// USTA League points per position: doubles lines worth 5, 4 and 3
const doubles = {
  collectionValueProfiles: [
    { collectionPosition: 3, matchUpValue: 3 },
    { collectionPosition: 1, matchUpValue: 5 },
    { collectionPosition: 2, matchUpValue: 4 },
  ],
  matchUpFormat: 'SET3-S:6/TB7-F:TB10',
  collectionName: 'Doubles',
  matchUpType: 'DOUBLES',
  collectionGroupNumber: 1,
  collectionOrder: 2,
  collectionId: 'D',
  matchUpCount: 3,
  gender: 'MALE',
};

describe('tieFormatRows', () => {
  it('reads collectionValueProfiles as line values, ordered by collectionPosition', () => {
    const row = rowFromCollection(doubles, mintId);
    expect(row.awardType).toBe(LINE_VALUES);
    expect(row.lineValues).toEqual([5, 4, 3]);
    expect(lineValuesTotal(row)).toBe(12);
  });

  it('round-trips line values and every field the editor does not manage', () => {
    const definition = collectionFromRow(rowFromCollection(doubles, mintId));
    expect(definition.collectionValueProfiles).toEqual([
      { collectionPosition: 1, matchUpValue: 5 },
      { collectionPosition: 2, matchUpValue: 4 },
      { collectionPosition: 3, matchUpValue: 3 },
    ]);
    expect(definition.collectionGroupNumber).toBe(1);
    expect(definition.collectionOrder).toBe(2);
    expect(definition.matchUpValue).toBeUndefined();
  });

  it('writes exactly one value declaration, so switching away from line values drops the profiles', () => {
    const row = rowFromCollection(doubles, mintId);
    row.awardType = MATCH_VALUE;
    row.awardValue = 1;
    const definition = collectionFromRow(row);
    expect(definition.matchUpValue).toBe(1);
    expect(definition.collectionValueProfiles).toBeUndefined();

    row.awardType = COLLECTION_VALUE;
    expect(
      Object.keys(collectionFromRow(row)).filter((key) => key.endsWith('Value') || key.endsWith('Profiles')),
    ).toEqual(['collectionValue']);
  });

  it('seeds line values from the current per-match value when switching to line values', () => {
    const row = rowFromCollection(
      { collectionId: 'S', matchUpType: 'SINGLES', matchUpCount: 2, matchUpValue: 2 },
      mintId,
    );
    expect(row.awardType).toBe(MATCH_VALUE);
    expect(seedLineValues(row)).toEqual([2, 2]);
  });

  it('keeps one value per line when the number of lines changes', () => {
    expect(resizeLineValues([5, 4, 3], 2)).toEqual([5, 4]);
    expect(resizeLineValues([5, 4], 4)).toEqual([5, 4, 1, 1]);
    expect(resizeLineValues([5], 0)).toEqual([]);

    const row = rowFromCollection(doubles, mintId);
    row.matchUpCount = 2; // lineValues not yet resized: the written profiles still follow matchUpCount
    expect(collectionFromRow(row).collectionValueProfiles).toHaveLength(2);
  });

  it('mints a collectionId only when one is missing', () => {
    expect(rowFromCollection(doubles, mintId).collectionId).toBe('D');
    expect(rowFromCollection({ matchUpCount: 1, matchUpValue: 1 }, mintId).collectionId).toBe('minted');
  });

  it('produces a tieFormat the factory accepts: points per position is first to 11 of 21', () => {
    const singles = {
      collectionValueProfiles: [
        { collectionPosition: 1, matchUpValue: 5 },
        { collectionPosition: 2, matchUpValue: 4 },
      ],
      matchUpFormat: 'SET3-S:6/TB7-F:TB10',
      matchUpType: 'SINGLES',
      collectionId: 'S',
      matchUpCount: 2,
    };
    const collectionDefinitions = [singles, { ...doubles, collectionGroupNumber: undefined }].map((col) =>
      collectionFromRow(rowFromCollection(col, mintId)),
    );
    const winCriteria = tournamentEngine.calculateWinCriteria({ collectionDefinitions });
    expect(winCriteria.valueGoal).toBe(11);

    const result = scoreGovernor.validateTieFormat({ tieFormat: { collectionDefinitions, winCriteria } });
    expect(result.error).toBeUndefined();
  });
});
