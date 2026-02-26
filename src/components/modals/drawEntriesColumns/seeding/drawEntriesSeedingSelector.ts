/**
 * Seeding options selector for draw entries modal.
 * Dynamically provides seeding options for all rating types present in table columns.
 */
import { enableManualSeeding } from 'components/tables/eventsTable/seeding/enableManualSeeding';
import { generateSeedValues } from 'components/tables/eventsTable/seeding/generateSeedValues';
import { clearSeeding } from 'components/tables/eventsTable/seeding/removeSeeding';
import { drawDefinitionConstants } from 'tods-competition-factory';

import { ACCEPTED, RIGHT } from 'constants/tmxConstants';

const { QUALIFYING } = drawDefinitionConstants;

export const drawEntriesSeedingSelector = (event: any, drawStage: string, table: any): any => {
  // Determine group based on draw stage (MAIN -> ACCEPTED, QUALIFYING -> QUALIFYING)
  const group = drawStage === QUALIFYING ? QUALIFYING : ACCEPTED;

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
