import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { addDraw } from 'components/drawers/addDraw/addDraw';

import { DRAWS_VIEW, QUALIFYING } from 'constants/tmxConstants';

export function generateQualifying({ drawData, eventId, drawId }: { drawData: any; eventId: string; drawId: string }): void {
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
      callback: (result: any) => {
        const structureId = result.drawDefinition?.structures?.find(({ stage }: any) => stage === QUALIFYING)?.structureId;
        navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
      },
      isQualifying: true,
      drawName,
      eventId,
      drawId
    } as any);
  };
  button.className = 'button is-info';
  button.innerHTML = 'Generate qualifying';
  generatePanel.appendChild(button);

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (drawsView) drawsView.appendChild(generatePanel);
}
