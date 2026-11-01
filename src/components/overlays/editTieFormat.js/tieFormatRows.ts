/**
 * Pure conversion between a tieFormat's collectionDefinitions and the editor's rows.
 * Kept free of DOM so the round trip can be tested: a collection field the editor does not manage
 * (collectionGroupNumber, category, collectionOrder, ...) must survive an edit, not be dropped.
 */
import { COLLECTION_VALUE, LINE_VALUES, MATCH_VALUE, SCORE_VALUE, SET_VALUE } from 'constants/tmxConstants';

export interface CollectionRow {
  collectionName: string;
  collectionId: string;
  matchUpType: string;
  matchUpCount: number;
  matchUpFormat: string;
  gender: string;
  awardType: string;
  awardValue: number;
  /** one value per line (collectionPosition 1..matchUpCount), used when awardType is LINE_VALUES */
  lineValues: number[];
  /** collection fields the editor does not manage, carried through unchanged */
  preserved: Record<string, any>;
}

const VALUE_KEYS = ['collectionValueProfiles', 'collectionValue', 'matchUpValue', 'scoreValue', 'setValue'];
const MANAGED_KEYS = new Set([
  ...VALUE_KEYS,
  'collectionName',
  'collectionId',
  'matchUpType',
  'matchUpCount',
  'matchUpFormat',
  'gender',
]);

export function capitalize(str: string): string {
  if (!str) return str;
  const lower = str.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function profileLineValues(col: any): number[] {
  return [...(col.collectionValueProfiles ?? [])]
    .sort((a: any, b: any) => a.collectionPosition - b.collectionPosition)
    .map((profile: any) => profile.matchUpValue);
}

export function rowFromCollection(col: any, mintId: () => string): CollectionRow {
  const lineValues = profileLineValues(col);
  const awardType =
    (lineValues.length > 0 && LINE_VALUES) ||
    (col.collectionValue != null && COLLECTION_VALUE) ||
    (col.scoreValue != null && SCORE_VALUE) ||
    (col.setValue != null && SET_VALUE) ||
    MATCH_VALUE;
  const awardValue = col.collectionValue ?? col.scoreValue ?? col.setValue ?? col.matchUpValue ?? 1;
  const matchUpCount = col.matchUpCount || 1;

  const preserved = Object.fromEntries(Object.entries(col).filter(([key]) => !MANAGED_KEYS.has(key)));

  return {
    lineValues: resizeLineValues(lineValues, matchUpCount),
    matchUpType: capitalize(col.matchUpType || 'SINGLES'),
    collectionId: col.collectionId || mintId(),
    gender: capitalize(col.gender || 'ANY'),
    collectionName: col.collectionName || '',
    matchUpFormat: col.matchUpFormat || '',
    matchUpCount,
    awardValue,
    awardType,
    preserved,
  };
}

/** one value per line: extra lines are dropped, new lines are worth 1 */
export function resizeLineValues(values: number[], count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => values[i] ?? 1);
}

/**
 * The line count is typed a keystroke at a time (3, then empty, then 4), so while it changes the values only grow: a
 * line past the count keeps its value until the count comes back, and saving drops it.
 */
export function growLineValues(values: number[], count: number): number[] {
  return resizeLineValues(values, Math.max(count, values.length));
}

/** switching to line values starts every line at the collection's current per-match value */
export function seedLineValues(row: CollectionRow): number[] {
  return resizeLineValues([], row.matchUpCount).map(() => row.awardValue);
}

export function collectionFromRow(row: CollectionRow): any {
  const isLineValues = row.awardType === LINE_VALUES;
  const value = (awardType: string) => (row.awardType === awardType ? row.awardValue : undefined);

  const definition: Record<string, any> = {
    ...row.preserved,
    collectionValueProfiles: isLineValues
      ? resizeLineValues(row.lineValues, row.matchUpCount).map((matchUpValue, i) => ({
          collectionPosition: i + 1,
          matchUpValue,
        }))
      : undefined,
    collectionValue: value(COLLECTION_VALUE),
    matchUpValue: value(MATCH_VALUE),
    scoreValue: value(SCORE_VALUE),
    setValue: value(SET_VALUE),
    matchUpType: row.matchUpType.toUpperCase(),
    collectionName: row.collectionName,
    matchUpFormat: row.matchUpFormat,
    gender: row.gender.toUpperCase(),
    collectionId: row.collectionId,
    matchUpCount: row.matchUpCount,
  };

  return Object.fromEntries(Object.entries(definition).filter(([, v]) => v !== undefined && v !== ''));
}

export function lineValuesTotal(row: CollectionRow): number {
  return resizeLineValues(row.lineValues, row.matchUpCount).reduce((sum, v) => sum + (v || 0), 0);
}
