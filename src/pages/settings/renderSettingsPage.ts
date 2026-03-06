import { ensureSettingsStyles } from 'pages/tournament/tabs/settingsTab/renderSettingsTab';
import { renderSettingsGrid } from 'pages/tournament/tabs/settingsTab/settingsGrid';
import { showTMXsettings } from 'services/transitions/screenSlaver';
import { removeAllChildNodes } from 'services/dom/transformers';
import { homeNavigation } from 'homeNavigation';
import { context } from 'services/context';

import { TMX_SETTINGS, SETTINGS } from 'constants/tmxConstants';

export function renderSettingsPage(): void {
  showTMXsettings();
  homeNavigation(SETTINGS);

  const tmxButton = document.getElementById('provider');
  if (tmxButton) tmxButton.onclick = () => context.router?.navigate('/tournaments');

  const container = document.getElementById(TMX_SETTINGS);
  if (!container) return;

  ensureSettingsStyles();
  removeAllChildNodes(container);
  renderSettingsGrid(container, { excludeTournament: true });
}
