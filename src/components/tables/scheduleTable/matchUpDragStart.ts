import { context } from 'services/context';

import { UNSCHEDULED } from 'constants/tmxConstants';

export function matchUpDragStart(ev: DragEvent, unscheduled?: boolean): void {
  const matchUpId = (ev.target as HTMLElement).id;
  ev.dataTransfer?.setData('itemid', matchUpId);
  if (unscheduled && ev.dataTransfer) {
    ev.dataTransfer.setData('itemtype', UNSCHEDULED);
    ev.dataTransfer.setDragImage(context.dragMatch, 10, 10);
  }
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move';
  }
}
