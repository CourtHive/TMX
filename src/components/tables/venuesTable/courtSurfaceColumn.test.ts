import { describe, expect, it, vi } from 'vitest';

// The unit suite runs in node: these touch `document` at import time (see columnDefinitionOptions.test.ts).
vi.mock('i18n', () => ({ t: (key: string) => key }));
vi.mock('courthive-components', () => ({}));
vi.mock('tabulator-tables', () => ({ TabulatorFull: class {} }));
vi.mock('../../popovers/courtActions', () => ({ courtActions: vi.fn() })); // reaches the mutation services

import { getCourtColumns } from './getCourtColumns';
import { t } from 'i18n';

// The courts table's Surface column read `surfaceType`, but CODES carries the surface class (CLAY, HARD, ...) in
// `surfaceCategory`, which is what the facilities registry, imports and the court cards use. A court surfaced in
// CODES showed an empty Surface column.
const surfaceOf = (court: any) => {
  const column: any = getCourtColumns().find((c: any) => c.title === t('tables.courts.surface'));
  return column.mutator ? column.mutator(court[column.field], court) : court[column.field];
};

describe('courts table Surface column', () => {
  it('shows the CODES surfaceCategory', () => {
    expect(surfaceOf({ courtId: 'c1', surfaceCategory: 'CLAY' })).toBe('CLAY');
  });

  it('still shows a category that an earlier TMX wrote into surfaceType', () => {
    expect(surfaceOf({ courtId: 'c1', surfaceType: 'GRASS' })).toBe('GRASS');
  });

  it('prefers surfaceCategory when both are present', () => {
    expect(surfaceOf({ courtId: 'c1', surfaceCategory: 'HARD', surfaceType: 'Plexicushion' })).toBe('HARD');
  });
});
