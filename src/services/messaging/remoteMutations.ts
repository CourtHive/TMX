/**
 * Remote mutation handler — applies mutations broadcast by the server
 * when another TMX client modifies a tournament we're currently viewing.
 *
 * Flow:
 *   Server broadcasts `tournamentMutation` → socketIo handler → this module
 *   → applies mutations locally via factory engine → saves to IndexedDB
 *   → shows sync indicator in navbar (click to re-render current page)
 */
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { onTournamentMutation } from 'services/messaging/socketIo';
import { tmxToast } from 'services/notifications/tmxToast';
import { debugConfig } from 'config/debugConfig';
import * as factory from 'tods-competition-factory';
import { context } from 'services/context';

import { SYNC_INDICATOR, TOURNAMENT_ENGINE } from 'constants/tmxConstants';

interface RemoteMutationPayload {
  methods: any[];
  tournamentIds: string[];
  userId?: string;
  timestamp?: number;
}

/**
 * Initialize the remote mutation listener.
 * Call once at app startup (e.g. in initialState.ts).
 */
export function initRemoteMutationHandler(): void {
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
      // Re-render the current page by re-navigating to the current route
      const current = context.router?.current?.[0];
      if (current?.url) {
        context.router?.navigate(current.url);
      }
    });
  }
}

async function handleRemoteMutation(data: RemoteMutationPayload): Promise<void> {
  const { methods, tournamentIds, userId } = data;
  if (!methods?.length || !tournamentIds?.length) return;

  const factoryEngine = factory[TOURNAMENT_ENGINE];
  if (!factoryEngine) return;

  // Only apply if we have at least one of the affected tournaments loaded
  const loadedRecords = factoryEngine.getState()?.tournamentRecords ?? {};
  const affected = tournamentIds.filter((id) => loadedRecords[id]);
  if (!affected.length) return;

  if (debugConfig.get().log?.verbose) {
    console.log('%c [remoteMutation] applying', 'color: orange', { userId, methods: methods.length });
  }

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

  // Show sync indicator in the navbar
  showSyncIndicator();

  // Emit a local event so the active view can optionally react
  context.ee.emit('remoteMutation', { methods, tournamentIds });
}
