import { closedFilled, openedFilled } from 'assets/specialCharacters/openClose';
import { findParentByClassName } from 'services/dom/findParentByClass';

import { BUTTON_BAR, EMPTY_STRING, HEADER, NONE, TMX_PANEL, TMX_TABLE } from 'constants/tmxConstants';

export const panelHeader = (heading, count = 0) => {
  const text = `${heading} ${count}`;
  return {
    location: HEADER,
    text
  };
};

export const togglePanel = (target) => {
  const element = target?.className.includes('panelHeader') ? target?.getElementsByClassName('toggle')[0] : target;
  if (!element) return;

  const tmxPanel = findParentByClassName(target, TMX_PANEL);
  const buttonBar = tmxPanel.getElementsByClassName(BUTTON_BAR)?.[0];
  const tmxTable = tmxPanel.getElementsByClassName(TMX_TABLE)?.[0];
  if (element) {
    const open = element.innerHTML.charCodeAt(0) === 9660;
    buttonBar.style.display = open ? NONE : EMPTY_STRING;
    tmxTable.style.display = open ? NONE : EMPTY_STRING;
    element.parentNode.innerHTML = `<span class='toggle' style='color: white'>${
      open ? closedFilled : openedFilled
    }</span>`;
  }
};

export const panelCollapse = () => {
  const onClick = (e) => togglePanel(e.target);
  return {
    onClick,
    headerClick: onClick,
    text: `<span class='toggle' style='color: white'>${openedFilled}</span>`,
    location: HEADER
  };
};

export const panelItems = ({ heading, count }) => [panelHeader(heading, count), panelCollapse];
