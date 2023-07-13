import { findAncestor, getChildrenByClassName } from 'services/dom/parentAndChild';
import { cellBorder } from '../../common/formatters/cellBorder';

import { NONE } from 'constants/tmxConstants';

export function enableManualSeeding(e, table) {
  const optionsRight = findAncestor(e.target, 'options_right');
  const saveSeeding = getChildrenByClassName(optionsRight, 'saveSeeding')?.[0];
  const cancelManualSeeding = getChildrenByClassName(optionsRight, 'cancelManualSeeding')?.[0];
  if (saveSeeding) {
    const dropdown = findAncestor(e.target, 'dropdown');
    if (cancelManualSeeding) cancelManualSeeding.style.display = '';
    saveSeeding.style.display = '';
    dropdown.style.display = NONE;
  }
  table.updateColumnDefinition('seedNumber', { formatter: cellBorder, editable: true });
}
