import { eventConstants } from 'tods-competition-factory';

import { LEFT } from 'constants/tmxConstants';

const { SINGLES, DOUBLES } = eventConstants;

export function getCollectionDefinitionColumns() {
  return [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5
    },
    {
      field: 'collectionName',
      title: 'Name',
      editor: true
    },
    {
      field: 'matchUpCount',
      headerSort: false,
      title: '#',
      width: 70
    },
    {
      field: 'matchUpType',
      editor: 'list',
      title: 'Type',

      editorParams: {
        itemFormatter: (_, value) => value[0].toUpperCase() + value.substring(1).toLowerCase(),
        values: {
          SINGLES: SINGLES,
          DOUBLES: DOUBLES
        }
      }
    },
    {
      title: 'Category',
      field: 'category'
    },
    {
      title: 'Gender',
      field: 'gender'
    },
    {
      title: 'Score format',
      field: 'matchUpFormat'
    },
    {
      title: 'Award type',
      field: 'awardType'
    },
    {
      title: 'Award value',
      field: 'awardValue'
    }
  ];
}
