/**
 * Handles application menu actions from the Electron main process.
 *
 * Registered once during app initialization. Maps menu action strings
 * to the corresponding TMX functions (import, export, etc.).
 */
import { exportTournamentRecord } from 'components/modals/exportTournamentRecord';
import { importTournaments } from 'services/storage/importTournaments';
import { getLoginState } from 'services/authentication/loginState';
import { openModal } from 'components/modals/baseModal/baseModal';
import { platform } from 'platform';
import { context } from 'services/context';

import { ADMIN, SUPER_ADMIN } from 'constants/tmxConstants';

function isAdmin(): boolean {
  const state = getLoginState();
  return !!(state?.roles?.includes(SUPER_ADMIN) || state?.roles?.includes(ADMIN));
}

export function registerMenuHandler(): void {
  if (!platform.onMenuAction) return;

  platform.onMenuAction((action: string) => {
    switch (action) {
      case 'open-tournament': {
        const table = context.tables?.tournamentsTable;
        if (table) {
          importTournaments({ table });
        }
        break;
      }

      case 'export-tournament':
        exportTournamentRecord();
        break;

      case 'toggle-devtools':
        if (isAdmin()) {
          platform.toggleDevTools?.();
        }
        break;

      case 'about':
        openModal({
          title: 'About TMX',
          content: 'TMX Tournament Management — Desktop Edition',
          buttons: [{ label: 'OK', intent: 'is-primary', close: true }],
        });
        break;
    }
  });

  // Secret key combo: Ctrl+Shift+F12 (or Cmd+Shift+F12 on Mac)
  // Opens DevTools for admin/superadmin users
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'F12' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (isAdmin()) {
        platform.toggleDevTools?.();
      }
    }
  });
}
