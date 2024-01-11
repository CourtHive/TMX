import { mapMatchUp } from 'pages/Tournament/Tabs/matchUpsTab/mapMatchUp';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { getCollectionColumns } from './getCollectionColumns';

export function createCollectionTable({ matchUp, tableElement, collectionMatchUps }) {
  const data = collectionMatchUps.map((collectionMatchUp) =>
    mapMatchUp({ ...collectionMatchUp, dualMatchUp: matchUp })
  );

  const columns = getCollectionColumns({ matchUp });

  const table = new Tabulator(tableElement, {
    responsiveLayoutCollapseStartOpen: false,
    responsiveLayout: 'collapse',
    placeholder: 'No matches',
    reactiveData: true,
    layout: 'fitColumns',
    index: 'matchUpId',
    columns,
    data
  });

  return { table };
}
