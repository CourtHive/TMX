/**
 * Column definitions for draw entries table in modal.
 * Similar to event entries 'Accepted' table with seeding support.
 * Rating columns are generated dynamically from entry data.
 */
import { formatParticipant } from 'components/tables/common/formatters/participantFormatter';
import { getRatingColumns } from 'components/tables/common/getRatingColumns';
import { numericEditor } from 'components/tables/common/editors/numericEditor';

import { CENTER, LEFT } from 'constants/tmxConstants';
import { t } from 'i18n';

export interface GetDrawEntriesColumnsParams {
  entries: any[];
  exclude?: string[];
}

export function getDrawEntriesColumns({ entries, exclude = [] }: GetDrawEntriesColumnsParams): any[] {
  const ratingColumns = getRatingColumns(entries, 'entry').map((col) => ({ ...col, widthGrow: 1, minWidth: 80, width: undefined }));
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
    ...ratingColumns,
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
