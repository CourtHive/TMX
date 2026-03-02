import { findAncestor } from 'services/dom/parentAndChild';
import { setSeedingEnabled } from './seedingState';

import { NONE } from 'constants/tmxConstants';

const SEEDING_BUTTON_CLASSES = ['saveSeeding', 'cancelManualSeeding'];

export function hideSaveSeeding(e: any, table: any): void {
  setSeedingEnabled(table, false);

  const optionsRight = findAncestor(e.target, 'options_right');
  if (optionsRight) {
    for (const child of optionsRight.children) {
      const isTarget = Array.from(child.classList).some((c) => SEEDING_BUTTON_CLASSES.includes(c as string));
      (child as HTMLElement).style.display = isTarget ? NONE : '';
    }
  }

  table.redraw(true);
}
