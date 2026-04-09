import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { t } from 'i18n';

import { DRAWS_VIEW } from 'constants/tmxConstants';

export function generateMain({ drawData, eventId, drawId }: { drawData: any; eventId: string; drawId: string }): void {
  const generatePanel = document.createElement('div');
  generatePanel.className = 'flexcol flexcenter';
  generatePanel.style.width = '100%';
  generatePanel.style.height = '300px';

  const message = document.createElement('p');
  message.textContent = t('drawers.addDraw.noMainDraw');
  message.style.cssText = 'color: var(--tmx-text-secondary, #888); margin-bottom: 1em;';
  generatePanel.appendChild(message);

  const button = document.createElement('button');
  button.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const drawName = drawData.drawName;
    addDraw({
      callback: (result: any) => {
        const structureId = result.drawDefinition?.structures?.find(
          ({ stage }: any) => stage === 'MAIN',
        )?.structureId;
        navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
      },
      isPopulateMain: true,
      drawName,
      eventId,
      drawId,
    });
  };
  button.className = 'button is-info';
  button.innerHTML = t('drawers.addDraw.generateMainDraw');
  generatePanel.appendChild(button);

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (drawsView) drawsView.appendChild(generatePanel);
}
