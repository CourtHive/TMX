import { closedFilled, openedFilled } from 'assets/specialCharacters/openClose';
import { findAncestor } from 'services/dom/parentAndChild';

import { BUTTON_BAR, EMPTY_STRING, ENTRIES_COUNT, HEADER, NONE, TMX_PANEL, TMX_TABLE } from 'constants/tmxConstants';

export const panelHeader = (heading, count = 0) => {
  const text = `${heading} <span class='${ENTRIES_COUNT}'>${count}</span>`;
  return {
    location: HEADER,
    text
  };
};

export const togglePanel = ({ target, table, close }) => {
  if (!target) return;

  const tmxPanel = findAncestor(target, TMX_PANEL);
  const toggle = tmxPanel.getElementsByClassName('toggle')?.[0];
  const buttonBar = tmxPanel.getElementsByClassName(BUTTON_BAR)?.[0];
  const tmxTable = tmxPanel.getElementsByClassName(TMX_TABLE)?.[0];
  if (toggle) {
    const open = close || toggle.innerHTML.charCodeAt(0) === 9660;
    buttonBar.style.display = open ? NONE : EMPTY_STRING;
    tmxTable.style.display = open ? NONE : EMPTY_STRING;
    toggle.parentNode.innerHTML = `<span class='toggle' style='color: white'>${
      open ? closedFilled : openedFilled
    }</span>`;

    // ensure data display
    if (!open) table.redraw(true);
  }
};

export const panelCollapse = (table) => {
  const onClick = (e) => togglePanel({ target: e.target, table });
  return {
    headerClick: onClick,
    text: `<span class='toggle' style='color: white'>${openedFilled}</span>`,
    location: HEADER,
    onClick
  };
};

export const panelItems = ({ heading, count }) => [panelHeader(heading, count), (table) => panelCollapse(table)];
