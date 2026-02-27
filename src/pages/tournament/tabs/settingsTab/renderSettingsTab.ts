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

    .panel-blue   { border-color: var(--tmx-panel-blue-border); background: var(--tmx-panel-blue-bg); }
    .panel-green  { border-color: var(--tmx-panel-green-border); background: var(--tmx-panel-green-bg); }
    .panel-orange { border-color: var(--tmx-panel-orange-border); background: var(--tmx-panel-orange-bg); }
    .panel-purple { border-color: var(--tmx-panel-purple-border); background: var(--tmx-panel-purple-bg); }
    .panel-teal   { border-color: var(--tmx-panel-teal-border); background: var(--tmx-panel-teal-bg); }
    .panel-red    { border-color: var(--tmx-panel-red-border); background: var(--tmx-panel-red-bg); }
    .panel-gray   { border-color: var(--tmx-border-primary); background: var(--tmx-bg-secondary); }

    .settings-panel label.radio {
      white-space: nowrap;
    }

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
