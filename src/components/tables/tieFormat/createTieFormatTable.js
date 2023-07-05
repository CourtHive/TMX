import { getCollectionDefinitionColumns } from './getCollectionDefinitionColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

export function createTieFormatTable({ tableElement, tieFormat }) {
  const data = (tieFormat?.collectionDefinitions || []).map((collectionDefinition) => collectionDefinition);

  const columns = getCollectionDefinitionColumns();

  const table = new Tabulator(tableElement, {
    responsiveLayoutCollapseStartOpen: false,
    columnDefaults: { headerSort: false },
    placeholder: 'No collections',
    responsiveLayout: 'collapse',
    index: 'collectionId',
    reactiveData: true,
    layout: 'fitColumns',
    movableRows: true,
    minHeight: 200,
    columns,
    data
  });

  table.on('rowMoved', () => {
    const rows = table.getRows();
    rows.forEach((r, i) => r.update({ ...data[i], collectionOrder: i + 1 }));
  });

  return { table };
}
