import { flightsFormatter } from '../common/formatters/flightsFormatter';
import { genderedText } from '../common/formatters/genderedText';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { entryActions } from '../../popovers/entryActions';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

export function getEntriesColumns({ entries, exclude = [], eventId, drawId, actions = [] } = {}) {
  const seedMax = entries.length || 0;
  const seedEditor = (cell, onRendered, success) => {
    const editor = document.createElement('input');
    editor.style.backgroundColor = 'lightyellow';
    editor.style.boxSizing = 'border-box';
    editor.style.textAlign = 'center';
    editor.style.padding = '3px';
    editor.style.height = '100%';
    editor.style.width = '100%';
    editor.value = cell.getValue() || '';

    onRendered(() => {
      editor.focus();
      editor.select();
    });

    function successFunc() {
      success(editor.value);
    }

    editor.addEventListener('keyup', (e) => {
      const allNumeric = parseInt(e.target.value.replace(/[^0-9]/g, '') || 0) || '';
      e.target.value = allNumeric > seedMax ? '' : allNumeric;
    });
    editor.addEventListener('change', successFunc);
    editor.addEventListener('blur', successFunc);

    return editor;
  };

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
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55,
      headerMenu
    },
    {
      formatter: 'responsiveCollapse',
      responsive: false,
      headerSort: false,
      hozAlign: CENTER,
      resizable: false,
      width: 50
    },
    {
      formatter: genderedText,
      field: 'participant.participantName',
      responsive: false,
      resizable: false,
      minWidth: 200,
      widthGrow: 1,
      title: 'Name'
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      resizable: false,
      sorter: 'number',
      field: 'ranking',
      title: 'Rank',
      width: 70
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      field: 'ratings.wtn.wtnRating',
      resizable: false,
      sorter: 'number',
      title: 'WTN',
      width: 70
    },
    {
      title: 'City/State',
      field: 'cityState',
      responsive: false,
      resizable: false,
      minWidth: 100
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      editor: seedEditor,
      field: 'seedNumber',
      hozAlign: CENTER,
      resizable: false,
      sorter: 'number',
      editable: false,
      title: 'Seed',
      maxWidth: 70
    },
    {
      formatter: flightsFormatter(navigateToEvent),
      title: 'Flights',
      responsive: true,
      field: 'flights',
      minWidth: 100,
      widthGrow: 1
    },
    {
      responsive: false,
      resizable: false,
      title: 'Status',
      field: 'status',
      maxWidth: 80
    },
    {
      cellClick: entryActions(actions, eventId, drawId),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      maxWidth: 40
    }
  ].filter(({ field }) => Array.isArray(exclude) && !exclude?.includes(field));
}
