/**
 * Column definitions for unscheduled matchUps table.
 * Displays event, flight, round, participants, and scoring format information.
 */
import { genderConstants } from 'tods-competition-factory';
import { isObject } from 'functions/typeOf';
import { t } from 'i18n';

import { CENTER } from 'constants/tmxConstants';

const { MALE, FEMALE } = genderConstants;

export function getUnscheduledColumns(unscheduledMatchUps: any[]): any[] {
  function genderedParticipant(cell: any): HTMLDivElement {
    const elem = document.createElement('div');
    const value = cell.getValue();
    const color = (isObject(value) && (value as any)?.sex === MALE && 'var(--tmx-accent-blue)') || ((value as any)?.sex === FEMALE && '#AA336A') || '';
    elem.style.color = color;
    elem.innerHTML = (isObject(value) ? (value as any).participantName : value) || '';
    return elem;
  }

  function formatCell(cell: any): HTMLDivElement {
    const element = document.createElement('div');
    element.innerHTML = cell.getValue();
    return element;
  }

  function titleFormatter(cell: any): number {
    const elem = cell.getElement();
    elem.classList.add('tag');
    elem.classList.add('is-info');
    elem.classList.add('is-light');
    return unscheduledMatchUps?.length || 0;
  }

  const participantSorter = (a: any, b: any) => {
    if (a.participantName && !b.participantName) return 1;
    if (b.participantName && !a.participantName) return 1;
    if (!a?.participantName && !b?.participantName) return 1;
    return a?.participantName?.localeCompare(b?.participantName);
  };

  return [
    {
      titleFormatter,
      formatter: 'rownum',
      headerSort: false,
      hozAlign: CENTER,
      frozen: true,
      width: 55,
    },
    {
      formatter: formatCell,
      field: 'eventName',
      resizable: false,
      title: t('tables.unscheduled.event'),
      visible: true,
      minWidth: 250,
    },
    {
      title: t('tables.unscheduled.flight'),
      field: 'flight',
    },
    {
      formatter: formatCell,
      field: 'roundName',
      resizable: false,
      title: t('tables.unscheduled.round'),
      minWidth: 90,
    },
    {
      formatter: genderedParticipant,
      sorter: participantSorter,
      responsive: false,
      resizable: false,
      title: t('tables.unscheduled.side1'),
      minWidth: 120,
      field: 'side1',
    },
    {
      formatter: genderedParticipant,
      sorter: participantSorter,
      responsive: false,
      resizable: false,
      title: t('tables.unscheduled.side2'),
      minWidth: 120,
      field: 'side2',
    },
    {
      field: 'matchUp.matchUpFormat',
      title: t('tables.unscheduled.scoringFormat'),
      formatter: formatCell,
      responsive: false,
      resizable: false,
      minWidth: 100,
    },
  ];
}
