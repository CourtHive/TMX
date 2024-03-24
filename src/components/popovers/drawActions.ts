import { editDisplaySettings } from 'components/modals/displaySettings/editDisplaySettings';
import { toggleDrawPublishState } from 'services/publishing/toggleDrawPublishState';
import { eventTabDeleteDraws } from 'components/tables/common/eventTabDeleteDraws';
import { deleteFlights } from 'components/modals/deleteFlights';
import { tmxToast } from 'services/notifications/tmxToast';
import { tipster } from 'components/popovers/tipster';

// constants
import { BOTTOM } from 'constants/tmxConstants';

export const drawActions = (eventRow) => (e, cell) => {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const target = e.target.getElementsByClassName('fa-ellipsis-vertical')[0];

  const row = cell.getRow();
  const data = row?.getData();
  const { published, drawId, eventId } = data;

  /**
  const doneEditing = ({ success, eventUpdates }) => {
    if (success) {
      row.update(eventRow);
    }
  };
   */

  const deleteDraw = () => {
    const callback = (result) => {
      if (!result.success) {
        result.error?.message && tmxToast({ message: result.error.message, intent: 'is-danger' });
      }
      eventTabDeleteDraws({ eventRow, drawsTable: cell.getTable(), drawIds: [drawId] });
    };
    deleteFlights({ eventId, drawIds: [drawId], callback });
  };

  const publish = () => {
    toggleDrawPublishState(eventRow)(e, cell);
  };

  const items = [
    {
      onClick: () => editDisplaySettings({ drawId: data.drawId }),
      text: 'Display settings',
    },
    {
      text: published ? 'Unpublish' : 'Publish',
      onClick: publish,
    },
    {
      onClick: deleteDraw,
      text: 'Delete',
    },
    {
      // onClick: () => editEvent({ event: data.event, callback: doneEditing }),
      text: 'Edit',
    },
  ];

  tipster({ items, target: target || e.target, config: { placement: BOTTOM } });
};
