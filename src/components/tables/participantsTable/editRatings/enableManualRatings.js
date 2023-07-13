import { cellBorder } from 'components/tables/common/formatters/cellBorder';
import { findAncestor } from 'services/dom/parentAndChild';

import { NONE } from 'constants/tmxConstants';

export function enableManualRatings(e, table) {
  const optionsRight = findAncestor(e.target, 'options_right');
  for (const child of optionsRight.children) {
    const isTarget = Array.from(child.classList).includes('saveRatings');
    child.style.display = isTarget ? '' : NONE;
  }

  table.updateColumnDefinition('ratings.wtn.wtnRating', { formatter: cellBorder, editable: true });
  table.updateColumnDefinition('ratings.utr.utrRating', { formatter: cellBorder, editable: true });
}
