import { editDisplaySettings } from 'components/modals/displaySettings/editDisplaySettings';
import { eventTabDeleteDraws } from 'components/tables/common/eventTabDeleteDraws';
import { deleteFlights } from 'components/modals/deleteFlights';
import { logMutationError } from 'functions/logMutationError';
import { updateDrawNameRows } from 'components/tables/common/updateDrawNameRows';
import { editDrawNames } from 'components/modals/editDrawNames';
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
  const { drawId, eventId } = data;

  const deleteDraw = () => {
    const callback = (result) => {
      if (!result.success) {
        logMutationError('deleteDraw', result);
      }
      eventTabDeleteDraws({ eventRow, drawsTable: cell.getTable(), drawIds: [drawId] });
    };
    deleteFlights({ eventId, drawIds: [drawId], callback });
  };

  const refreshDrawNames = (renamed: { drawId: string; drawName: string }[]) =>
    updateDrawNameRows(cell.getTable(), renamed);

  const items = [
    {
      onClick: () => editDisplaySettings({ drawId: data.drawId }),
      text: 'Display settings',
    },
    {
      onClick: deleteDraw,
      text: 'Delete',
    },
    {
      // Renames every draw in the event (a full edit-draw drawer would require
      // changing far more), so it matches the draws-list "Rename selected" modal.
      onClick: () => editDrawNames({ eventId, callback: refreshDrawNames }),
      text: 'Rename',
    },
  ];

  tipster({ items, target: target || e.target, config: { placement: BOTTOM } });
};
