import { ensureSettingsStyles } from 'pages/tournament/tabs/settingsTab/renderSettingsTab';
import { renderSettingsGrid } from 'pages/tournament/tabs/settingsTab/settingsGrid';
import { showTMXsettings } from 'services/transitions/screenSlaver';
import { removeAllChildNodes } from 'services/dom/transformers';
import { homeNavigation } from 'homeNavigation';

import { TMX_SETTINGS, SETTINGS } from 'constants/tmxConstants';

export function renderSettingsPage(): void {
  showTMXsettings();
  homeNavigation(SETTINGS);

  const container = document.getElementById(TMX_SETTINGS);
  if (!container) return;

  ensureSettingsStyles();
  removeAllChildNodes(container);
  renderSettingsGrid(container, { excludeTournament: true });
}
