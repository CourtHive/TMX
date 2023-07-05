import { getCollectionDefinitionColumns } from './getCollectionDefinitionColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

import { COLLECTION_VALUE, MATCH_VALUE, SCORE_VALUE, SET_VALUE } from 'constants/tmxConstants';

export function createTieFormatTable({ tableElement, tieFormat }) {
  const data = (tieFormat?.collectionDefinitions || []).map((collectionDefinition) => {
    const { collectionValue, matchUpValue, scoreValue, setValue } = collectionDefinition;
    const awardType =
      (collectionValue && COLLECTION_VALUE) || (scoreValue && SCORE_VALUE) || (setValue && SET_VALUE) || MATCH_VALUE;
    return {
      ...collectionDefinition,
      awardValue: collectionValue || matchUpValue || scoreValue || setValue,
      awardType
    };
  });

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
