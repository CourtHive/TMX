import { scheduleIssueSort } from 'functions/sorting/sorting';
import { competitionEngine } from 'tods-competition-factory';
import { isObject } from 'functions/typeOf';

import { scheduleClass } from 'constants/tmxConstants';

export function updateConflicts(table) {
  const data = table.getData();
  const rowItems = data.flatMap((row) => Object.values(row).filter(isObject)).filter((item) => item.matchUpId);
  const { courtIssues, rowIssues } = competitionEngine.proConflicts({ matchUps: rowItems });

  if ((courtIssues && Object.keys(courtIssues)?.length) || rowIssues) {
    // TODO: upper left corner alert icon; clicking on it scrolls and pans to issues
    // <i class="fa-solid fa-triangle-exclamation"></i> or <i class="fa-solid fa-triangle-exclamation" style="color: #f5220a;"></i>
  }

  if (data?.length) table.updateData(data);
  const controlCells = table.getColumns()[0].getCells();
  if (rowIssues?.length) {
    rowIssues.forEach((issues, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const controlCell = controlCells.find((cell) => cell.getData().rowNumber === rowNumber);
      if (controlCell) {
        controlCell.getElement().classList.forEach((c) => {
          if (c.startsWith('matchup')) controlCell.getElement().classList.remove(c);
        });
        const data = controlCell.getData();
        if (issues.length) {
          const sortedIssues = issues.sort(scheduleIssueSort);
          data.issues = sortedIssues;
          const issueClass = scheduleClass[sortedIssues[0].issue];
          controlCell.getElement().classList.add(issueClass);
        } else {
          controlCell.getElement().style.backgroundColor = 'white';
          data.issues = [];
        }
      } else {
        console.log('control cell not found', { rowNumber });
      }
    });
  }
}
