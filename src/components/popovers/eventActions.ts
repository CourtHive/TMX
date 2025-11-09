/**
 * Event actions popover with publish, edit, and delete options.
 * Shows tipster menu for event management actions from table rows.
 */
import { editDisplaySettings } from 'components/modals/displaySettings/editDisplaySettings';
import { toggleEventPublishState } from 'services/publishing/toggleEventPublishState';
import { editEvent } from 'pages/tournament/tabs/eventsTab/editEvent';
import { deleteEvents } from 'components/modals/deleteEvents';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

export const eventActions = (nestedTables: any) => (e: MouseEvent, cell: any): void => {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const target = (e.target as HTMLElement).getElementsByClassName('fa-ellipsis-vertical')[0] as HTMLElement;
  const data = cell.getRow().getData();

  const row = cell.getRow();
  const eventRow = row?.getData();
  const published = eventRow?.published;

  const doneEditing = ({ success, eventUpdates }: any) => {
    if (success) {
      Object.assign(eventRow.event, eventUpdates);
      row.update(eventRow);
    }
  };

  const publish = () => {
    toggleEventPublishState(nestedTables)(e, cell);
  };

  const deleteEvent = () => {
    const eventIds = [data.eventId];
    const callback = (result: any) => {
      const table = cell.getTable();
      result.success && table?.deleteRow(eventIds);
    };
    return deleteEvents({ eventIds, callback });
  };

  const items = [
    {
      onClick: () => editDisplaySettings({ eventId: data.eventId }),
      text: 'Display settings',
    },
    {
      text: published ? 'Unpublish' : 'Publish',
      onClick: publish,
    },
    {
      onClick: deleteEvent,
      text: 'Delete',
    },
    {
      onClick: () => editEvent({ event: data.event, callback: doneEditing }),
      text: 'Edit',
    },
  ];

  tipster({ items, target: target || (e.target as HTMLElement), config: { placement: BOTTOM } });
};
