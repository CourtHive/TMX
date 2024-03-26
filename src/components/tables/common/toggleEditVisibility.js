import { cellBorder } from 'components/tables/common/formatters/cellBorder';
import { findAncestor } from 'services/dom/parentAndChild';

import { NONE } from 'constants/tmxConstants';

export function toggleEditVisibility(params) {
  const { e, table, classNames = [], className, visible, columns } = params;
  const optionsRight = findAncestor(e.target, 'options_right');
  const targetState = visible ? '' : NONE;
  const otherState = visible ? NONE : '';

  // show or hide the options_right in the control bar
  for (const child of optionsRight.children) {
    const isTarget = className
      ? Array.from(child.classList).includes(className)
      : Array.from(child.classList).some((c) => classNames.includes(c));
    child.style.display = isTarget ? targetState : otherState;
  }

  // update the column definitions
  for (const column of columns) {
    table.updateColumnDefinition(column, { formatter: visible ? cellBorder : undefined, editable: visible });
  }
}
