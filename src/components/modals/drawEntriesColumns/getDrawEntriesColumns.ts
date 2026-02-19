/**
 * Column definitions for draw entries table in modal.
 * Similar to event entries 'Accepted' table with seeding support.
 */
import { formatParticipant } from 'components/tables/common/formatters/participantFormatter';
import { ratingFormatter } from 'components/tables/common/formatters/ratingFormatter';
import { numericEditor } from 'components/tables/common/editors/numericEditor';
import { ratingSorter } from 'components/tables/common/sorters/ratingSorter';
import { factoryConstants } from 'tods-competition-factory';

import { CENTER, LEFT } from 'constants/tmxConstants';
import { t } from 'i18n';

const { WTN, UTR } = factoryConstants.ratingConstants;

export interface GetDrawEntriesColumnsParams {
  entries: any[];
  exclude?: string[];
}

export function getDrawEntriesColumns({ entries, exclude = [] }: GetDrawEntriesColumnsParams): any[] {
  const utrRating = entries.find((entry) => entry.ratings?.utr);
  const wtnRating = entries.find((entry) => entry.ratings?.wtn);
  const cityState = entries.find((entry) => entry.cityState);
  const seeding = entries.find((entry) => entry.seedNumber);
  const ranking = entries.find((entry) => entry.ranking);

  return [
    {
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55,
    },
    {
      formatter: 'responsiveCollapse',
      responsive: false,
      headerSort: false,
      hozAlign: CENTER,
      width: 50,
    },
    {
      formatter: (cell: any) => (formatParticipant(undefined) as any)(cell, undefined, 'sideBySide'),
      field: 'participant',
      responsive: false,
      minWidth: 250,
      widthGrow: 3,
      title: t('tables.drawEntries.name'),
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      visible: !!ranking,
      sorter: 'number',
      field: 'ranking',
      title: t('tables.drawEntries.rank'),
      widthGrow: 1,
      minWidth: 80,
    },
    {
      formatter: ratingFormatter(WTN),
      sorter: ratingSorter(WTN),
      visible: !!wtnRating,
      field: 'ratings.wtn',
      title: WTN,
      widthGrow: 1,
      minWidth: 80,
    },
    {
      formatter: ratingFormatter(UTR),
      sorter: ratingSorter(UTR),
      visible: !!utrRating,
      field: 'ratings.utr',
      title: UTR,
      widthGrow: 1,
      minWidth: 80,
    },
    {
      visible: !!cityState,
      title: t('tables.drawEntries.cityState'),
      field: 'cityState',
      responsive: false,
      minWidth: 150,
      widthGrow: 2,
    },
    {
      editor: numericEditor({ maxValue: entries?.length || 0, decimals: false, field: 'seedNumber' }),
      sorterParams: { alignEmptyValues: 'bottom' },
      visible: !!seeding,
      field: 'seedNumber',
      hozAlign: CENTER,
      sorter: 'number',
      editable: false,
      title: t('tables.drawEntries.seed'),
      maxWidth: 70,
    },
  ].filter(({ field }) => Array.isArray(exclude) && !exclude?.includes(field || ''));
}
