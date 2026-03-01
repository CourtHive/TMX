/**
 * Update schedule conflicts visualization in table.
 * Analyzes matchUp scheduling conflicts and highlights rows with issues.
 */
import { scheduleIssueSort } from 'functions/sorting/sorting';
import { competitionEngine, factoryConstants } from 'tods-competition-factory';
import { isObject } from 'functions/typeOf';

import { scheduleClass } from 'constants/tmxConstants';

const { scheduleConstants } = factoryConstants;

export function updateConflicts(table: any, matchUps?: any[]): void {
  const data = table.getData();
  const rowItems = data
    .flatMap((row: any) => Object.values(row).filter(isObject))
    .filter((item: any) => item.matchUpId);

  const { courtIssues, rowIssues } = competitionEngine.proConflicts({ matchUps: matchUps ?? rowItems });

  if ((courtIssues && Object.keys(courtIssues)?.length) || rowIssues) {
    // TODO: upper left corner alert icon; clicking on it scrolls and pans to issues
    // <i class="fa-solid fa-triangle-exclamation"></i> or <i class="fa-solid fa-triangle-exclamation" style="color: #f5220a;"></i>
  }

  // Create a map of matchUpId to issue details for easy lookup
  const matchUpIssues = new Map<string, any>();
  if (rowIssues) {
    const allIssues = rowIssues.flat();

    allIssues.forEach((issue: any) => {
      if (issue.matchUpId) {
        matchUpIssues.set(issue.matchUpId, issue);
      }
    });
  }

  // Annotate matchUp data with issue details for cell formatting
  rowItems.forEach((item: any) => {
    if (item.matchUpId && matchUpIssues.has(item.matchUpId)) {
      const issue = matchUpIssues.get(item.matchUpId);
      item.issueType = issue.issueType;
      item.issueIds = issue.issueIds; // Store related matchUpIds for hover highlighting

      // Set the SCHEDULE_STATE based on the actual issue type (WARNING, ERROR, CONFLICT, ISSUE)
      if (!item.schedule) item.schedule = {};
      item.schedule[scheduleConstants.SCHEDULE_STATE] = issue.issue;
    } else {
      delete item.issueType; // Clear any previous issueType
      delete item.issueIds;
      if (item.schedule) {
        delete item.schedule[scheduleConstants.SCHEDULE_STATE];
      }
    }
  });

  if (data?.length) {
    table.updateData(data);
  }

  // Update row control cells
  const controlCells = table.getColumns()[0].getCells();
  if (rowIssues?.length) {
    rowIssues.forEach((issues: any[], rowIndex: number) => {
      const rowNumber = rowIndex + 1;
      const controlCell = controlCells.find((cell: any) => cell.getData().rowNumber === rowNumber);
      if (controlCell) {
        controlCell.getElement().classList.forEach((c: string) => {
          if (c.startsWith('matchup')) controlCell.getElement().classList.remove(c);
        });
        const data = controlCell.getData();
        if (issues.length) {
          issues.sort(scheduleIssueSort);
          data.issues = issues;
          const issueClass = (scheduleClass as any)[issues[0].issue];
          controlCell.getElement().classList.add(issueClass);
        } else {
          controlCell.getElement().style.backgroundColor = 'var(--tmx-bg-primary)';
          data.issues = [];
        }
      }
    });
  }

  // Update column headers with court issues
  if (courtIssues && Object.keys(courtIssues).length) {
    const columns = table.getColumns();

    // Skip the first column (control column) and iterate through court columns
    columns.slice(1).forEach((column: any) => {
      const columnDef = column.getDefinition();
      const courtId = columnDef.meta?.courtId;
      const headerElement = column.getElement().querySelector('.tabulator-col-content');

      if (!headerElement) return;

      // Clear existing matchup classes
      headerElement.classList.forEach((c: string) => {
        if (c.startsWith('matchup')) headerElement.classList.remove(c);
      });

      // Apply issue class if court has issues
      if (courtId && courtIssues[courtId]) {
        const issues = courtIssues[courtId];
        if (issues.length) {
          issues.sort(scheduleIssueSort);
          const issueClass = (scheduleClass as any)[issues[0].issue];
          if (issueClass) {
            headerElement.classList.add(issueClass);
          }
        }
      } else {
        // Reset background if no issues
        headerElement.style.backgroundColor = '';
      }
    });
  } else {
    // Clear all column header issues if no court issues exist
    const columns = table.getColumns();
    columns.slice(1).forEach((column: any) => {
      const headerElement = column.getElement().querySelector('.tabulator-col-content');
      if (headerElement) {
        headerElement.classList.forEach((c: string) => {
          if (c.startsWith('matchup')) headerElement.classList.remove(c);
        });
        headerElement.style.backgroundColor = '';
      }
    });
  }
}
