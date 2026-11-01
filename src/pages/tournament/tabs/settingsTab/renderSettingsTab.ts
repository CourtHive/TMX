import { removeAllChildNodes } from 'services/dom/transformers';
import { SETTINGS_GRID_COLUMNS } from './settingsLayout';
import { renderSettingsGrid } from './settingsGrid';

import { TOURNAMENT_SETTINGS } from 'constants/tmxConstants';

const STYLE_ID = 'settings-tab-styles';

export function ensureSettingsStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* ${SETTINGS_GRID_COLUMNS} columns; getSettingsLayout sizes each panel so every row fills the grid. */
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(${SETTINGS_GRID_COLUMNS}, minmax(0, 1fr));
      gap: 16px;
      padding: 16px;
    }
    /* Neutral: one surface and border for every panel. Only the Danger Zone keeps a colour. */
    .settings-panel {
      border-radius: 8px;
      padding: 20px;
      border: 1px solid var(--tmx-border-primary);
      background: var(--tmx-bg-elevated);
      color: var(--tmx-text-primary);
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
      color: var(--tmx-text-secondary);
    }

    /* Danger Zone (journey 82 selects the delete button by this class). */
    .settings-panel.panel-red {
      border-color: var(--tmx-status-error);
      border-left-width: 4px;
    }
    .settings-panel.panel-red h3,
    .settings-panel.panel-red h3 i {
      color: var(--tmx-status-error);
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
  void renderSettingsGrid(settingsContent);
}
