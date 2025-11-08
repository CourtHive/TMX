/**
 * Seeding options selector for events.
 * Provides options for manual seeding, seeding by ranking, WTN, or UTR.
 */
import { enableManualSeeding } from './enableManualSeeding';
import { generateSeedValues } from './generateSeedValues';
import { clearSeeding } from './removeSeeding';

import { RIGHT } from 'constants/tmxConstants';

export const seedingSelector = (event: any, group: string) => (table: any): any => {
  const labelMap: Record<string, string> = {
    ranking: 'Seed by ranking',
    'ratings.wtn': 'Seed by WTN',
    'ratings.utr': 'Seed by UTR',
  };

  const seedingColumns = table
    .getColumns()
    .map((col: any) => col.getDefinition())
    .filter((def: any) => ['ratings.wtn', 'ratings.utr'].includes(def.field));

  const options = [
    { label: 'Manual seeding', onClick: (e: any) => enableManualSeeding(e, table), close: true },
    { label: 'Clear seeding', onClick: () => clearSeeding({ event, table }), close: true },
  ].concat(
    ...seedingColumns.map((column: any) => ({
      onClick: () => generateSeedValues({ event, group, table, field: column.field }),
      label: labelMap[column.field],
      value: column.field,
      close: true,
    })),
  );

  return {
    class: 'seedingOptions',
    label: 'Seeding',
    selection: false,
    location: RIGHT,
    align: RIGHT,
    options,
  };
};
