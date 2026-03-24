/**
 * Remote mutation handler — applies mutations broadcast by the server
 * when another TMX client modifies a tournament we're currently viewing.
 *
 * Flow:
 *   Server broadcasts `tournamentMutation` → socketIo handler → this module
 *   → applies mutations locally via factory engine → saves to IndexedDB
 *   → refreshes active table data in-place (preserving sort/scroll)
 *   → shows sync indicator in navbar if no table could be refreshed
 */
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { onTournamentMutation } from 'services/messaging/socketIo';
import { tmxToast } from 'services/notifications/tmxToast';
import * as factory from 'tods-competition-factory';
import { debugConfig } from 'config/debugConfig';
import { context } from 'services/context';

// constants and types
import { SYNC_INDICATOR, TOURNAMENT_ENGINE } from 'constants/tmxConstants';
import type { RemoteMutationPayload } from 'types/services';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

/**
 * Initialize the remote mutation listener.
 * Call once at app startup (e.g. in initialState.ts).
 */
export function initRemoteMutationHandler(): void {
  slog('[remoteMutation] handler registered');
  onTournamentMutation(handleRemoteMutation);
}

/** Hide the sync indicator (called on navigation). */
export function clearSyncIndicator(): void {
  const el = document.getElementById(SYNC_INDICATOR);
  if (el) {
    el.style.display = 'none';
    el.classList.remove('sync-indicator--active');
  }
}

function showSyncIndicator(): void {
  const el = document.getElementById(SYNC_INDICATOR);
  if (!el) return;

  el.style.display = '';
  el.classList.add('sync-indicator--active');

  // Only attach the click handler once
  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('click', () => {
      clearSyncIndicator();
      if (context.refreshActiveTable) {
        slog('[syncIndicator] clicked — refreshing active table');
        context.refreshActiveTable();
      }
    });
  }
}

async function handleRemoteMutation(data: RemoteMutationPayload): Promise<void> {
  const { methods, tournamentIds, userId } = data;
  slog('[remoteMutation] received — methods:', methods?.length, 'tournaments:', tournamentIds, 'from:', userId);

  if (!methods?.length || !tournamentIds?.length) return;

  const factoryEngine = factory[TOURNAMENT_ENGINE];
  if (!factoryEngine) return;

  // Only apply if we have at least one of the affected tournaments loaded
  const loadedRecords = factoryEngine.getState()?.tournamentRecords ?? {};
  const affected = tournamentIds.filter((id) => loadedRecords[id]);
  if (!affected.length) {
    slog('[remoteMutation] skipped — none of the affected tournaments are loaded locally');
    return;
  }

  const methodNames = methods.map((m: any) => m.method || m.methodName || 'unknown');
  slog('[remoteMutation] applying %d methods from %s:', methods.length, userId, methodNames);

  // Execute the same mutations locally
  const directives = factory.tools.makeDeepCopy(methods);
  const result = factoryEngine.executionQueue(directives, true);

  if (result?.error) {
    console.warn('[remoteMutation] local execution failed:', result.error);
    tmxToast({ message: 'Remote update failed — please reload', intent: 'is-warning' });
    return;
  }

  // Persist to IndexedDB
  await saveTournamentRecord();

  // Refresh the active table in-place (preserves sort and scroll)
  if (context.refreshActiveTable) {
    slog('[remoteMutation] refreshing active table in-place');
    context.refreshActiveTable();
  } else {
    // No table refresh available — show sync indicator so user can manually refresh
    slog('[remoteMutation] no active table — showing sync indicator');
    showSyncIndicator();
  }

  // Emit a local event so the active view can optionally react
  context.ee.emit('remoteMutation', { methods, tournamentIds });
}
