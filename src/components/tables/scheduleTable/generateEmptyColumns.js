import { renderScheduleTab } from 'pages/tournament/tabs/scheduleTab/scheduleTab';
import { addVenue } from 'pages/tournament/tabs/venuesTab/addVenue';
import { scheduleCell } from '../common/formatters/scheduleCell';
import { tools } from 'tods-competition-factory';

import { CENTER } from 'constants/tmxConstants';

export function generateEmptyColumns({ courtsData, count }) {
  const emptyColumnHeaderClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    addVenue(renderScheduleTab);
  };
  const emptyColumnHeader = (index) => {
    if (index) return;

    return courtsData?.length || 0
      ? `<p style='font-weight: normal; color: lightblue'>Add venue</p>`
      : `<button class='button is-danger'>Add venue</button>`;
  };
  return count > 0
    ? tools.generateRange(0, count).map((index) => ({
        headerClick: (e) => index === 0 && emptyColumnHeaderClick(e),
        title: emptyColumnHeader(index),
        headerHozAlign: CENTER,
        formatter: scheduleCell,
        headerSort: false,
        resizable: false,
        minWidth: 150,
      }))
    : [];
}
