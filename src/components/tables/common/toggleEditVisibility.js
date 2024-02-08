import { cellBorder } from 'components/tables/common/formatters/cellBorder';
import { findAncestor } from 'services/dom/parentAndChild';

import { NONE } from 'constants/tmxConstants';

export function toggleEditVisibility({ e, table, classNames, className, visible, columns }) {
  const optionsRight = findAncestor(e.target, 'options_right');
  const targetState = visible ? '' : NONE;
  const otherState = visible ? NONE : '';

  for (const child of optionsRight.children) {
    const isTarget = className
      ? Array.from(child.classList).includes(className)
      : Array.from(child.classList).some((c) => classNames.includes(c));
    child.style.display = isTarget ? targetState : otherState;
  }

  for (const column of columns) {
    table.updateColumnDefinition(column, { formatter: visible ? cellBorder : undefined, editable: visible });
  }
}
