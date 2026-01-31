/**
 * Seeding options selector for draw entries modal.
 * Provides options for manual seeding, seeding by ranking, WTN, or UTR.
 */
import { enableManualSeeding } from 'components/tables/eventsTable/seeding/enableManualSeeding';
import { generateSeedValues } from 'components/tables/eventsTable/seeding/generateSeedValues';
import { clearSeeding } from 'components/tables/eventsTable/seeding/removeSeeding';
import { drawDefinitionConstants } from 'tods-competition-factory';

import { ACCEPTED, RIGHT } from 'constants/tmxConstants';

const { QUALIFYING } = drawDefinitionConstants;

export const drawEntriesSeedingSelector = (event: any, drawStage: string, table: any): any => {
  const labelMap: Record<string, string> = {
    ranking: 'Seed by ranking',
    'ratings.wtn': 'Seed by WTN',
    'ratings.utr': 'Seed by UTR',
  };

  // Determine group based on draw stage (MAIN -> ACCEPTED, QUALIFYING -> QUALIFYING)
  const group = drawStage === QUALIFYING ? QUALIFYING : ACCEPTED;

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
    class: 'seedingOptions', // Use same class as Event Entries for consistency
    label: 'Seeding',
    selection: false,
    location: RIGHT,
    align: RIGHT,
    options,
  };
};
