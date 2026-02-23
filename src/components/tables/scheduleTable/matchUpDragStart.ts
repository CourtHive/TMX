import { context } from 'services/context';

import { UNSCHEDULED } from 'constants/tmxConstants';

export function matchUpDragStart(ev: DragEvent, unscheduled?: boolean): void {
  const matchUpId = (ev.target as HTMLElement).id;
  ev.dataTransfer?.setData('itemid', matchUpId);
  if (unscheduled && ev.dataTransfer) {
    ev.dataTransfer.setData('itemtype', UNSCHEDULED);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const dragImage = (isDark && context.dragMatchLight) || context.dragMatch;
    ev.dataTransfer.setDragImage(dragImage, 10, 10);
  }
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move';
  }
}
