import { renderSystemTab } from './systemTab/renderSystemTab';
import { getLoginState } from 'services/authentication/loginState';
import { removeAllChildNodes } from 'services/dom/transformers';
import { renderSettingsGrid } from './settingsGrid';
import { renderAdminGrid } from './adminGrid';
import { controlBar } from 'courthive-components';
import { context } from 'services/context';

import { SETTINGS_CONTROL, TOURNAMENT_SETTINGS, SUPER_ADMIN, ADMIN, LEFT } from 'constants/tmxConstants';

const STYLE_ID = 'settings-tab-styles';

let currentView: 'settings' | 'admin' | 'system' = 'settings';

function ensureStyles(): void {
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

function isAdmin(): boolean {
  const state = getLoginState();
  if (!state) return false;
  if (state.roles?.includes(SUPER_ADMIN)) return true;
  if (state.roles?.includes(ADMIN) && context?.provider) return true;
  return false;
}

function isSuperAdmin(): boolean {
  const state = getLoginState();
  return !!state?.roles?.includes(SUPER_ADMIN);
}

function getSettingsTabs(callback: (view: 'settings' | 'admin' | 'system') => void) {
  const tabs = [
    {
      active: currentView === 'settings',
      onClick: () => callback('settings'),
      label: 'Settings',
      close: true,
    },
    {
      active: currentView === 'admin',
      onClick: () => callback('admin'),
      label: 'Admin',
      close: true,
    },
  ];

  if (isSuperAdmin()) {
    tabs.push({
      active: currentView === 'system',
      onClick: () => callback('system'),
      label: 'System',
      close: true,
    });
  }

  return tabs;
}

export function renderSettingsTab(): void {
  const settingsControl = document.getElementById(SETTINGS_CONTROL);
  const settingsContent = document.getElementById(TOURNAMENT_SETTINGS);
  if (!settingsContent) return;

  ensureStyles();
  removeAllChildNodes(settingsContent);

  if (settingsControl) {
    removeAllChildNodes(settingsControl);

    if (isAdmin()) {
      const switchView = (view: 'settings' | 'admin' | 'system') => {
        if (view === currentView) return;
        currentView = view;
        renderSettingsTab();
      };

      const tabs = getSettingsTabs(switchView);
      controlBar({
        target: settingsControl,
        items: [{ id: 'settingsTabs', location: LEFT, tabs }],
      });
    }
  }

  if (currentView === 'settings') {
    renderSettingsGrid(settingsContent);
  } else if (currentView === 'admin') {
    renderAdminGrid(settingsContent);
  } else if (currentView === 'system') {
    renderSystemTab(settingsContent);
  }
}
