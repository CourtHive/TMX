import { enableManualSeeding } from './enableManualSeeding';
import { generateSeedValues } from './generateSeedValues';
import { clearSeeding } from './removeSeeding';

import { RIGHT } from 'constants/tmxConstants';

export const seedingSelector = (event, group) => (table) => {
  const labelMap = {
    ranking: 'Seed by ranking',
    'ratings.wtn': 'Seed by WTN',
    'ratings.utr': 'Seed by UTR',
  };

  const seedingColumns = table
    .getColumns()
    .map((col) => col.getDefinition())
    // TODO: add ranking to seedingColumns; filter out columns which have no values
    .filter((def) => ['ratings.wtn', 'ratings.utr'].includes(def.field));

  const options = [
    { label: 'Manual seeding', onClick: (e) => enableManualSeeding(e, table), close: true },
    { label: 'Clear seeding', onClick: () => clearSeeding({ event, table }), close: true },
  ].concat(
    ...seedingColumns.map((column) => ({
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
