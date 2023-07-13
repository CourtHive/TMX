import { findAncestor, getChildrenByClassName } from 'services/dom/parentAndChild';

import { NONE } from 'constants/tmxConstants';

export function hideSaveSeeding(e, table) {
  const optionsRight = findAncestor(e.target, 'options_right');
  const seedingOptions = getChildrenByClassName(optionsRight, 'seedingOptions')?.[0];
  const cancelManualSeeding = getChildrenByClassName(optionsRight, 'cancelManualSeeding')?.[0];
  const saveSeeding = getChildrenByClassName(optionsRight, 'saveSeeding')?.[0];
  if (seedingOptions) {
    if (cancelManualSeeding) cancelManualSeeding.style.display = NONE;
    if (saveSeeding) saveSeeding.style.display = NONE;
    seedingOptions.style.display = '';
  }
  table.updateColumnDefinition('seedNumber', { formatter: undefined, editable: false });
}
