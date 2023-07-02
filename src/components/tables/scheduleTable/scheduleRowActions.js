import { scheduleSetMatchUpHeader } from 'components/popovers/scheduleSetMatchUpHeader';
import { timeItemConstants } from 'tods-competition-factory';
import { timeFormat } from 'functions/timeStrings';
import { isObject } from 'functions/typeOf';

const { NOT_BEFORE } = timeItemConstants;

export function rowActions(e, cell) {
  const rowData = cell.getRow().getData();
  const matchUps = Object.values(rowData).filter((c) => c?.matchUpId);
  if (rowData.issues?.length) console.log({ issues: rowData.issues });

  if (matchUps.length) {
    const callback = (schedule) => {
      if (isObject(schedule)) {
        const table = cell.getTable();
        const targetRow = table.getData().find((row) => row.rowId === rowData.rowId);
        Object.values(targetRow).forEach((c) => {
          if (c.matchUpId) {
            if (schedule.scheduledTime) {
              c.schedule.scheduledTime = timeFormat(schedule.scheduledTime);
              if (c.schedule.timeModifiers?.[0] !== NOT_BEFORE) {
                c.schedule.timeModifiers = '';
              }
            }

            if (schedule.timeModifiers) {
              if (c.schedule.scheduledTime && schedule.timeModifiers[0] !== NOT_BEFORE) {
                c.schedule.scheduledTime = '';
              }
              c.schedule.timeModifiers = schedule.timeModifiers;
            }
          }
        });
        table.updateData([targetRow]);
      }
    };
    scheduleSetMatchUpHeader({ e, cell, rowData, callback });
  }
}
