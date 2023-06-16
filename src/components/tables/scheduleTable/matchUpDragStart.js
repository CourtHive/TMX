import { context } from 'services/context';

import { UNSCHEDULED } from 'constants/tmxConstants';

export function matchUpDragStart(ev, unscheduled) {
  const matchUpId = ev.target.id;
  ev.dataTransfer.setData('itemid', matchUpId);
  if (unscheduled) {
    ev.dataTransfer.setData('itemtype', UNSCHEDULED);
    ev.dataTransfer.setDragImage(context.dragMatch, 10, 10);
  }
  ev.dataTransfer.effectAllowed = 'move';
}
