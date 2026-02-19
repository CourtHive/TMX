/**
 * Column definitions for tie format collection definitions table.
 * Manages collection names, match counts, types, genders, and scoring formats.
 */
import { getMatchUpFormatModal } from 'courthive-components';

import {
  CENTER,
  COLLECTION_VALUE,
  LEFT,
  MATCHUP_FORMAT,
  MATCH_VALUE,
  SCORE_VALUE,
  SET_VALUE
} from 'constants/tmxConstants';
import { t } from 'i18n';

export function getCollectionDefinitionColumns(): any[] {
  const editMatchUpFormat = (_e: Event, cell: any) => {
    const row = cell.getRow();
    const data = row.getData();
    const callback = (matchUpFormat: string) => {
      if (matchUpFormat) {
        Object.assign(data, { matchUpFormat });
        row.update(data);
        const table = cell.getTable();
        table.redraw(true);
      }
    };
    (getMatchUpFormatModal as any)({ 
      callback, 
      existingMatchUpFormat: data.matchUpFormat,
      modalConfig: {
        style: {
          fontSize: '12px',
          border: '3px solid #0066cc',
        }
      }
    });
  };
  return [
    { rowHandle: true, formatter: 'handle', width: 30, minWidth: 30 },
    {
      cellClick: (_: Event, cell: any) => cell.getRow().toggleSelect(),
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
      title: t('tables.tieFormat.name'),
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
      title: t('tables.tieFormat.type'),
      width: 100,

      editorParams: { values: ['Singles', 'Doubles'] }
    },
    {
      title: t('tables.tieFormat.gender'),
      field: 'gender',
      editor: 'list',
      width: 100,

      editorParams: { values: ['Male', 'Female', 'Any'] }
    },
    {
      cellClick: editMatchUpFormat,
      title: t('tables.tieFormat.scoreFormat'),
      field: MATCHUP_FORMAT,
      minWidth: 150
    },
    {
      title: t('tables.tieFormat.awardType'),
      field: 'awardType',
      editor: 'list',
      width: 150,

      editorParams: { values: [COLLECTION_VALUE, MATCH_VALUE, SET_VALUE, SCORE_VALUE] }
    },
    {
      field: 'awardValue',
      editor: 'number',
      title: t('tables.tieFormat.value'),
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
