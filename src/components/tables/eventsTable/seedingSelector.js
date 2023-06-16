import { RIGHT } from 'constants/tmxConstants';

export const seedingSelector = (table) => {
  const labelMap = {
    ranking: 'Seed by ranking',
    'ratings.wtn': 'Seed by WTN'
  };
  const seedingColumns = table
    .getColumns()
    .map((col) => col.getDefinition())
    .filter((def) => ['ranking', 'ratings.wtn'].includes(def.field));
  const options = [
    { label: 'Manual seeding', onClick: () => console.log('Manual seeding', { table }), close: true }
  ].concat(
    ...seedingColumns.map((column) => ({
      onClick: () => console.log(`Seed by ${column.field}`),
      label: labelMap[column.field],
      value: column.field,
      close: true
    }))
  );
  return {
    options,
    label: 'Seeding',
    selection: false,
    location: RIGHT,
    align: RIGHT
  };
};
