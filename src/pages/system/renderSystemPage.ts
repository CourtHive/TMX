import { renderSystemTab } from 'pages/tournament/tabs/settingsTab/systemTab/renderSystemTab';
import { removeAllChildNodes } from 'services/dom/transformers';
import { showTMXsystem } from 'services/transitions/screenSlaver';
import { context } from 'services/context';
import { TMX_SYSTEM } from 'constants/tmxConstants';

export function renderSystemPage(selectedTab?: string): void {
  showTMXsystem();

  const tmxButton = document.getElementById('provider');
  if (tmxButton) tmxButton.onclick = () => context.router?.navigate('/tournaments');

  const container = document.getElementById(TMX_SYSTEM);
  if (!container) return;

  removeAllChildNodes(container);
  renderSystemTab(container, selectedTab);
}
