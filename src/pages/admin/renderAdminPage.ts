import { ensureSettingsStyles } from 'pages/tournament/tabs/settingsTab/renderSettingsTab';
import { renderAdminGrid } from 'pages/tournament/tabs/settingsTab/adminGrid';
import { removeAllChildNodes } from 'services/dom/transformers';
import { showTMXadmin } from 'services/transitions/screenSlaver';
import { context } from 'services/context';
import { TMX_ADMIN } from 'constants/tmxConstants';

export function renderAdminPage(): void {
  showTMXadmin();

  const tmxButton = document.getElementById('provider');
  if (tmxButton) tmxButton.onclick = () => context.router?.navigate('/tournaments');

  const container = document.getElementById(TMX_ADMIN);
  if (!container) return;

  removeAllChildNodes(container);
  ensureSettingsStyles();
  renderAdminGrid(container);
}
