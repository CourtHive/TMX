/**
 * Seeding options selector for events.
 * Dynamically provides seeding options for all rating types present in table columns.
 */
import { enableManualSeeding } from './enableManualSeeding';
import { generateSeedValues } from './generateSeedValues';
import { clearSeeding } from './removeSeeding';

// constants
import { RIGHT } from 'constants/tmxConstants';

export const seedingSelector =
  (event: any, group: string) =>
  (table: any): any => {
    // Dynamically find all rating columns in the table
    const seedingColumns = table
      .getColumns()
      .map((col: any) => col.getDefinition())
      .filter((def: any) => def.field?.startsWith('ratings.'));

    const options = [
      { label: 'Manual seeding', onClick: (e: any) => enableManualSeeding(e, table), close: true },
      { label: 'Clear seeding', onClick: () => clearSeeding({ event, table }), close: true },
    ].concat(
      ...seedingColumns.map((column: any) => ({
        onClick: () => generateSeedValues({ event, group, table, field: column.field }),
        label: `Seed by ${column.title}`,
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
