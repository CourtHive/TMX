/**
 * Schedule row action handlers for matchUps.
 * Handles bulk schedule time and time modifier updates for all matchUps in a row.
 */
import { scheduleSetMatchUpHeader } from 'components/popovers/scheduleSetMatchUpHeader';
import { timeItemConstants } from 'tods-competition-factory';
import { timeFormat } from 'functions/timeStrings';
import { isObject } from 'functions/typeOf';

const { NOT_BEFORE } = timeItemConstants;

export function rowActions(e: any, cell: any): void {
  const rowData = cell.getRow().getData();
  const matchUps = Object.values(rowData).filter((c: any) => c?.matchUpId);
  if (rowData.issues?.length) console.log({ issues: rowData.issues });

  if (matchUps.length) {
    const callback = (schedule: any) => {
      if (isObject(schedule)) {
        const table = cell.getTable();
        const targetRow = table.getData().find((row: any) => row.rowId === rowData.rowId);
        Object.values(targetRow).forEach((c: any) => {
          if (c?.matchUpId && c?.schedule) {
            if ((schedule as any).scheduledTime) {
              (c.schedule as any).scheduledTime = timeFormat((schedule as any).scheduledTime);
              if ((c.schedule as any).timeModifiers?.[0] !== NOT_BEFORE) {
                (c.schedule as any).timeModifiers = [];
              }
            }

            if ((schedule as any).timeModifiers) {
              if (c.schedule?.scheduledTime && (schedule as any).timeModifiers[0] !== NOT_BEFORE) {
                c.schedule.scheduledTime = '';
              }
              if (c.schedule) (c.schedule as any).timeModifiers = (schedule as any).timeModifiers;
            }
          }
        });
        table.updateData([targetRow]);
      }
    };
    scheduleSetMatchUpHeader({ e, cell, rowData, callback });
  }
}
