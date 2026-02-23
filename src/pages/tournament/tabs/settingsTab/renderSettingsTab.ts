import { removeAllChildNodes } from 'services/dom/transformers';
import { renderSettingsGrid } from './settingsGrid';

import { TOURNAMENT_SETTINGS } from 'constants/tmxConstants';

const STYLE_ID = 'settings-tab-styles';

export function ensureSettingsStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      padding: 16px;
    }
    .settings-panel {
      border-radius: 8px;
      padding: 20px;
      border-left: 4px solid;
    }
    .settings-panel h3 {
      margin: 0 0 12px 0;
      font-size: 1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .settings-panel h3 i {
      font-size: 0.9rem;
    }

    .panel-blue   { border-color: #4a90d9; background: #eef4fb; }
    .panel-green  { border-color: #48c774; background: #effaf3; }
    .panel-orange { border-color: #ff9f43; background: #fff5eb; }
    .panel-purple { border-color: #b86bff; background: #f5eeff; }
    .panel-teal   { border-color: #00b8a9; background: #e6faf8; }
    .panel-red    { border-color: #ff6b6b; background: #fef0f0; }

    @media (max-width: 900px) {
      .settings-grid { grid-template-columns: 1fr; }
      .settings-grid > * { grid-column: 1 / -1 !important; }
    }
  `;
  document.head.appendChild(style);
}

export function renderSettingsTab(): void {
  const settingsContent = document.getElementById(TOURNAMENT_SETTINGS);
  if (!settingsContent) return;

  ensureSettingsStyles();
  removeAllChildNodes(settingsContent);
  renderSettingsGrid(settingsContent);
}
