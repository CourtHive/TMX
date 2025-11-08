import { scheduleClass } from 'constants/tmxConstants';

const issueTypes = Object.keys(scheduleClass);
export function scheduleIssueSort(a: any, b: any): number {
  return issueTypes.indexOf(a.issue) - issueTypes.indexOf(b.issue);
}

export function stringSort(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
