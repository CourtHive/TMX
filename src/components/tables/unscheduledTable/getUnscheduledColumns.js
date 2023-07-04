import { genderConstants } from 'tods-competition-factory';
import { isObject } from 'functions/typeOf';

import { CENTER } from 'constants/tmxConstants';

const { MALE, FEMALE } = genderConstants;

export function getUnscheduledColumns(unscheduledMatchUps) {
  function genderedParticipant(cell) {
    const elem = document.createElement('div');
    const value = cell.getValue();
    const color = (isObject(value) && value?.sex === MALE && '#2E86C1') || (value?.sex === FEMALE && '#AA336A') || '';
    elem.style.color = color;
    elem.innerHTML = (isObject(value) ? value.participantName : value) || '';
    return elem;
  }

  function formatCell(cell) {
    const element = document.createElement('div');
    element.innerHTML = cell.getValue();
    return element;
  }

  function titleFormatter(cell) {
    const elem = cell.getElement();
    elem.classList.add('tag');
    elem.classList.add('is-info');
    elem.classList.add('is-light');
    return unscheduledMatchUps?.length || 0;
  }

  const participantSorter = (a, b) => {
    if (a.participantName && !b.participantName) return 1;
    if (b.participantName && !a.participantName) return 1;
    if (!a?.participantName && !b?.participantName) return 1;
    return a?.participantName?.localeCompare(b?.participantName);
  };

  return [
    {
      titleFormatter,
      formatter: 'rownum', // format this to show open/close caret
      headerSort: false,
      hozAlign: CENTER,
      frozen: true,
      width: 55
    },
    {
      formatter: formatCell,
      field: 'eventName',
      resizable: false,
      title: 'Event',
      visible: true,
      minWidth: 250
    },
    {
      formatter: formatCell,
      field: 'roundName',
      resizable: false,
      title: 'Round',
      minWidth: 90
    },
    {
      formatter: genderedParticipant,
      sorter: participantSorter,
      responsive: false,
      resizable: false,
      title: 'Side 1',
      minWidth: 120,
      field: 'side1'
    },
    {
      formatter: genderedParticipant,
      sorter: participantSorter,
      responsive: false,
      resizable: false,
      title: 'Side 2',
      minWidth: 120,
      field: 'side2'
    },
    {
      field: 'matchUp.matchUpFormat',
      title: 'Scoring Format',
      formatter: formatCell,
      responsive: false,
      resizable: false,
      minWidth: 100
      /*
    },
    {
      // field: 'matchUp.matchUpFormat',
      title: 'Average Time',
      formatter: formatCell,
      responsive: false,
      resizable: false,
      minWidth: 100
    */
    }
  ];
}
