import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { getCollectionColumns } from './getCollectionColumns';
import { t } from 'i18n';

export function createCollectionTable({
  matchUp,
  tableElement,
  collectionMatchUps,
}: {
  matchUp: any;
  tableElement: HTMLElement;
  collectionMatchUps: any[];
}): { table: any } {
  const data = collectionMatchUps.map((collectionMatchUp: any) =>
    mapMatchUp({ ...collectionMatchUp, dualMatchUp: matchUp }),
  );

  const columns = getCollectionColumns({ matchUp });

  const table = new Tabulator(tableElement, {
    responsiveLayoutCollapseStartOpen: false,
    responsiveLayout: 'collapse',
    placeholder: t('ui.noMatches'),
    reactiveData: true,
    layout: 'fitColumns',
    index: 'matchUpId',
    columns,
    data,
  });

  return { table };
}
