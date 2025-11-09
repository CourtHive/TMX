/**
 * Move participants between entry status groups (e.g., from Accepted to Withdrawn).
 * Updates table data and displays success/error notifications.
 */
import { modifyEntriesStatus } from './modifyEntriesStatus';
import { context } from 'services/context';

import { OVERLAY } from 'constants/tmxConstants';
import { tmxToast } from 'services/notifications/tmxToast';

const moveTo = (table: any, group: string, eventId: string, drawId?: string): void => {
  const selected = table.getSelectedData();
  const participantIds = selected.filter((p: any) => !p.events?.length).map(({ participantId }: any) => participantId);

  const callback = (result: any) => {
    if (result?.success) {
      const data = table.getData();
      const targetRows = data.filter(({ participantId }: any) => participantIds.includes(participantId));
      context.tables[group].updateOrAddData(targetRows);
      table.deleteRow(participantIds);
    } else {
      table.deselectRow();
      tmxToast({ message: result.error.message ?? 'Error moving participants', intent: 'is-danger' });
    }
  };

  modifyEntriesStatus({ participantIds, group, eventId, drawId, callback });
};

export const moveSelected = (groups: string[], eventId: string, drawId?: string) => (table: any): any => {
  const options = groups.map((group) => ({
    onClick: () => moveTo(table, group, eventId, drawId),
    stateChange: true,
    label: group,
    value: group,
    close: true,
  }));

  return {
    label: 'Move participants',
    location: OVERLAY,
    options,
  };
};
