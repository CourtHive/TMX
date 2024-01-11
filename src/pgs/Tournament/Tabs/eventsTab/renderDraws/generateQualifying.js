import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { addDraw } from 'components/drawers/addDraw/addDraw';

import { DRAWS_VIEW, QUALIFYING } from 'constants/tmxConstants';

export function generateQualifying({ drawData, eventId, drawId }) {
  const generatePanel = document.createElement('div');
  generatePanel.className = 'flexcol flexcenter';
  generatePanel.style.width = '100%';
  generatePanel.style.height = '300px';

  const button = document.createElement('button');
  button.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const drawName = drawData.drawName;
    addDraw({
      callback: (result) => {
        const structureId = result.drawDefinition?.structures?.find(({ stage }) => stage === QUALIFYING)?.structureId;
        navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
      },
      isQualifying: true,
      drawName,
      eventId,
      drawId
    });
  };
  button.className = 'button is-info';
  button.innerHTML = 'Generate qualifying';
  generatePanel.appendChild(button);

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (drawsView) drawsView.appendChild(generatePanel);
}
