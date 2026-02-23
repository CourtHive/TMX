import { renderSystemTab } from 'pages/tournament/tabs/settingsTab/systemTab/renderSystemTab';
import { removeAllChildNodes } from 'services/dom/transformers';
import { showTMXsystem } from 'services/transitions/screenSlaver';
import { TMX_SYSTEM } from 'constants/tmxConstants';

export function renderSystemPage(): void {
  showTMXsystem();

  const container = document.getElementById(TMX_SYSTEM);
  if (!container) return;

  removeAllChildNodes(container);
  renderSystemTab(container);
}
