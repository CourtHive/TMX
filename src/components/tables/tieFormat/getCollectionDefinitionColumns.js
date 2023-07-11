import { getMatchUpFormat } from 'components/modals/matchUpFormat/matchUpFormat';
import { CENTER, COLLECTION_VALUE, LEFT, MATCH_VALUE, SCORE_VALUE, SET_VALUE } from 'constants/tmxConstants';

export function getCollectionDefinitionColumns() {
  const editMatchUpFormat = (e, cell) => {
    const row = cell.getRow();
    const data = row.getData();
    const callback = (matchUpFormat) => {
      if (matchUpFormat) {
        Object.assign(data, { matchUpFormat });
        row.update(data);
        const table = cell.getTable();
        table.redraw(true);
      }
    };
    getMatchUpFormat({ callback });
  };
  return [
    { rowHandle: true, formatter: 'handle', width: 30, minWidth: 30 },
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      responsive: false,
      hozAlign: LEFT,
      width: 5
    },
    {
      formatter: 'responsiveCollapse',
      responsive: false,
      resizable: false,
      hozAlign: CENTER,
      width: 50
    },
    {
      editorParams: { selectContents: true },
      field: 'collectionName',
      minWidth: 200,
      title: 'Name',
      editor: true
    },
    {
      field: 'matchUpCount',
      editor: 'number',
      title: '#',
      width: 70,

      editorParams: {
        elementAttributes: { maxlength: 2 },
        selectContents: true,
        mask: '99',
        step: 1,
        max: 20,
        min: 0
      }
    },
    {
      field: 'matchUpType',
      editor: 'list',
      title: 'Type',
      width: 100,

      editorParams: { values: ['Singles', 'Doubles'] }
    },
    /*
    // TODO: create a TODS Category code constructor similar to matchUpFormatCode constructor
    {
      title: 'Category', 
      field: 'category'
    },
    */
    {
      title: 'Gender',
      field: 'gender',
      editor: 'list',
      width: 100,

      editorParams: { values: ['Male', 'Female', 'Mixed'] }
    },
    {
      cellClick: editMatchUpFormat,
      title: 'Score format',
      field: 'matchUpFormat',
      minWidth: 150
    },
    {
      title: 'Award type',
      field: 'awardType',
      editor: 'list',
      width: 150,

      editorParams: { values: [COLLECTION_VALUE, MATCH_VALUE, SET_VALUE, SCORE_VALUE] }
    },
    {
      field: 'awardValue',
      editor: 'number',
      title: 'Value',
      width: 70,
      editorParams: {
        elementAttributes: { maxlength: 2 },
        selectContents: true,
        mask: '99',
        step: 1,
        max: 99,
        min: 0
      }
    }
  ];
}
