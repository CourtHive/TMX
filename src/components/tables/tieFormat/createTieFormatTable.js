import { getCollectionDefinitionColumns } from './getCollectionDefinitionColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

export function createTieFormatTable({ tableElement, tieFormat }) {
  const data = (tieFormat?.collectionDefinitions || []).map((collectionDefinition) => collectionDefinition);

  const columns = getCollectionDefinitionColumns();

  const table = new Tabulator(tableElement, {
    responsiveLayoutCollapseStartOpen: false,
    placeholder: 'No collections',
    responsiveLayout: 'collapse',
    index: 'collectionId',
    reactiveData: true,
    layout: 'fitColumns',
    columns,
    data
  });

  return { table };
}
