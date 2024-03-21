import { editDisplaySettings } from 'components/modals/displaySettings/editDisplaySettings';
import { toggleEventPublishState } from 'services/publishing/toggleEventPublishState';
import { editEvent } from 'pages/tournament/tabs/eventsTab/editEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';

// constants
import { DELETE_EVENTS } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';

export const eventActions = (nestedTables) => (e, cell) => {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const target = e.target.getElementsByClassName('fa-ellipsis-vertical')[0];
  const data = cell.getRow().getData();

  const row = cell.getRow();
  const eventRow = row?.getData();
  const published = eventRow?.published;

  const doneEditing = ({ success, eventUpdates }) => {
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
    const callback = (result) => {
      const table = cell.getTable();
      result.success && table?.deleteRow(eventIds);
    };
    mutationRequest({ methods: [{ method: DELETE_EVENTS, params: { eventIds } }], callback });
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

  tipster({ items, target: target || e.target, config: { placement: BOTTOM } });
};
