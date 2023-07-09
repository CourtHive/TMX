import { getCollectionDefinitionColumns } from './getCollectionDefinitionColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { toTitleCase } from 'functions/toTitleCase';

import { COLLECTION_VALUE, MATCH_VALUE, SCORE_VALUE, SET_VALUE } from 'constants/tmxConstants';

export function createTieFormatTable({ tableElement, tieFormat }) {
  const data = (tieFormat?.collectionDefinitions || []).map((collectionDefinition) => {
    const { collectionValue, matchUpValue, scoreValue, setValue, matchUpType, gender } = collectionDefinition;
    const awardType =
      (collectionValue && COLLECTION_VALUE) || (scoreValue && SCORE_VALUE) || (setValue && SET_VALUE) || MATCH_VALUE;
    return {
      ...collectionDefinition,
      awardValue: collectionValue || matchUpValue || scoreValue || setValue,
      matchUpType: toTitleCase(matchUpType),
      gender: toTitleCase(gender),
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

  return { table };
}
