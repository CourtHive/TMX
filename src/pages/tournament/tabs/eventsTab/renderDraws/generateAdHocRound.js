import { addAdHocRound } from 'components/modals/addAdHocRound';

import { DRAWS_VIEW } from 'constants/tmxConstants';

export function generateAdHocRound({ structure, drawId, callback }) {
  const generatePanel = document.createElement('div');
  generatePanel.className = 'flexcol flexcenter';
  generatePanel.style.width = '100%';
  generatePanel.style.height = '300px';

  const button = document.createElement('button');
  button.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    addAdHocRound({
      newRound: true,
      structure,
      callback,
      drawId,
    });
  };
  button.className = 'button is-info';
  button.innerHTML = 'Generate round';
  generatePanel.appendChild(button);

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (drawsView) drawsView.appendChild(generatePanel);
}
