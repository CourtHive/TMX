/**
 * Panel UI components for collapsible event table sections.
 * Provides header with count display and collapse/expand toggle functionality.
 */
import { closedFilled, openedFilled } from 'assets/specialCharacters/openClose';
import { findAncestor } from 'services/dom/parentAndChild';

import { BUTTON_BAR, EMPTY_STRING, ENTRIES_COUNT, HEADER, NONE, TMX_PANEL, TMX_TABLE } from 'constants/tmxConstants';

export const panelHeader = (heading: string, count: number = 0): any => {
  const text = `${heading} <span class='${ENTRIES_COUNT}'>${count}</span>`;
  return {
    location: HEADER,
    text
  };
};

export const togglePanel = ({ target, table, close }: { target: HTMLElement; table: any; close?: boolean }): void => {
  if (!target) return;

  const tmxPanel = findAncestor(target, TMX_PANEL);
  if (tmxPanel) {
    const toggle = tmxPanel.getElementsByClassName('toggle')?.[0] as HTMLElement;
    const buttonBar = tmxPanel.getElementsByClassName(BUTTON_BAR)?.[0] as HTMLElement;
    const tmxTable = tmxPanel.getElementsByClassName(TMX_TABLE)?.[0] as HTMLElement;
    if (toggle) {
      const open = close || toggle.innerHTML.charCodeAt(0) === 9660;
      buttonBar.style.display = open ? NONE : EMPTY_STRING;
      tmxTable.style.display = open ? NONE : EMPTY_STRING;
      (toggle.parentNode as HTMLElement).innerHTML = `<span class='toggle' style='color: white'>${
        open ? closedFilled : openedFilled
      }</span>`;

      if (!open) table.redraw(true);
    }
  }
};

export const panelCollapse = (table: any): any => {
  const onClick = (e: Event) => togglePanel({ target: e.target as HTMLElement, table });
  return {
    headerClick: onClick,
    text: `<span class='toggle' style='color: white'>${openedFilled}</span>`,
    location: HEADER,
    onClick
  };
};

export const panelItems = ({ heading, count }: { heading: string; count: number }): any[] => [
  panelHeader(heading, count),
  (table: any) => panelCollapse(table)
];
