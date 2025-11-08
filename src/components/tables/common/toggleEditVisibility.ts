import { cellBorder } from 'components/tables/common/formatters/cellBorder';
import { findAncestor } from 'services/dom/parentAndChild';

import { NONE } from 'constants/tmxConstants';

type ToggleEditVisibilityParams = {
  e: any;
  table: any;
  classNames?: string[];
  className?: string;
  visible: boolean;
  columns: string[];
};

export function toggleEditVisibility(params: ToggleEditVisibilityParams): void {
  const { e, table, classNames = [], className, visible, columns } = params;
  const optionsRight = findAncestor(e.target, 'options_right');
  const targetState = visible ? '' : NONE;
  const otherState = visible ? NONE : '';

  if (optionsRight) {
    for (const child of optionsRight.children) {
      const isTarget = className
        ? Array.from(child.classList).includes(className)
        : Array.from(child.classList).some((c) => classNames.includes(c));
      (child as HTMLElement).style.display = isTarget ? targetState : otherState;
    }
  }

  for (const column of columns) {
    table.updateColumnDefinition(column, { formatter: visible ? cellBorder : undefined, editable: visible });
  }
}
