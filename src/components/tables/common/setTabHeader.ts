/**
 * Set a tab section header to "<label> (<count>)", an optional "Selected: <n>", and an optional inline
 * right-aligned widget (e.g. the cards/table view toggle).
 *
 * The header is the `.tabHeader` element inside the section ancestor of the
 * given anchor. Layout is flex so the title sits at the start and the widget
 * (when provided) sits at the end on the same line.
 */

import { findAncestor } from 'services/dom/parentAndChild';
import { createTabHeaderTitle } from './tabHeaderTitle';

import './setTabHeader.css';

interface SetTabHeaderParams {
  anchor: HTMLElement;
  label: string;
  count: number;
  /** Rows selected in the table; omit for a view without row selection. */
  selected?: number;
  trailing?: HTMLElement;
}

export function setTabHeader({ anchor, label, count, selected, trailing }: SetTabHeaderParams): void {
  const header = findAncestor(anchor, 'section')?.querySelector('.tabHeader') as HTMLElement | null;
  if (!header) return;

  // Layout via class, not inline style, so `setEventView` clearing
  // `style.display` between renders doesn't undo it.
  header.classList.add('tabHeader--flex');

  while (header.firstChild) header.removeChild(header.firstChild);

  header.appendChild(createTabHeaderTitle({ label, count, selected }).element);

  if (trailing) header.appendChild(trailing);
}
