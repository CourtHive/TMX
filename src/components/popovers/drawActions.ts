import { editDisplaySettings } from 'components/modals/displaySettings/editDisplaySettings';
import { toggleDrawPublishState } from 'services/publishing/toggleDrawPublishState';
import { eventTabDeleteDraws } from 'components/tables/common/eventTabDeleteDraws';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';

// constants
import { DELETE_FLIGHT_AND_DRAW } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';
import { tmxToast } from 'services/notifications/tmxToast';

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
    const methods = [
      {
        params: { eventId, drawId, force: false },
        method: DELETE_FLIGHT_AND_DRAW,
      },
    ];
    const callback = (result) => {
      if (!result.success) {
        result.error?.message && tmxToast({ message: result.error.message, intent: 'is-danger' });
      }
      eventTabDeleteDraws({ eventRow, drawsTable: cell.getTable(), drawIds: [drawId] });
    };
    mutationRequest({ methods, callback });
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
