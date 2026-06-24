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
import { onTournamentMutation, joinTournamentRoom } from 'services/messaging/socketIo';
import { extractDeletedDrawIds } from 'services/scheduling/drawExistenceGuard';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { notifyMutationApplied } from 'services/mutation/mutationObservers';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { buildInlineNotice } from 'components/notices/inlineNotice';
import { requestTournament } from 'services/apis/servicesApi';
import { tmxToast } from 'services/notifications/tmxToast';
import * as factory from 'tods-competition-factory';
import { debugConfig } from 'config/debugConfig';
import { context } from 'services/context';
import { t } from 'i18n';

// constants and types
import { SYNC_INDICATOR, TOURNAMENT_ENGINE, DRAWS_VIEW } from 'constants/tmxConstants';
import type { RemoteMutationPayload } from 'types/services';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

/** When set, the sync indicator is in "stale" mode: the local copy is behind the
 * server (detected by the staleness probe) and a click must pull the full record
 * from the server, not just re-render the active table from local state. */
let staleRefreshTournamentId: string | undefined;

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
  staleRefreshTournamentId = undefined;
  clearActiveDrawDeletedBanner();
  const el = document.getElementById(SYNC_INDICATOR);
  if (el) {
    el.style.display = 'none';
    el.classList.remove('sync-indicator--active');
  }
}

/** Parse the actively-viewed draw route from the URL hash, if any. */
function getActiveDrawRoute(): { eventId: string; drawId: string } | null {
  const m = window.location.hash.match(/\/event\/([^/?]+)\/draw\/([^/?]+)/);
  return m ? { eventId: m[1], drawId: m[2] } : null;
}

let activeDrawDeletedBanner: HTMLElement | null = null;

function clearActiveDrawDeletedBanner(): void {
  if (activeDrawDeletedBanner) {
    activeDrawDeletedBanner.remove();
    activeDrawDeletedBanner = null;
  }
}

/**
 * Phase 2 (draws-only): when a remote mutation deletes the draw the user is
 * currently viewing, the draw view's data is gone. Rather than yank them away
 * mid-action, show a persistent inline banner explaining it with a "Return to
 * event" action. The banner clears on the next navigation (clearSyncIndicator).
 */
function reactToActiveDrawDeletion(methods: any[]): void {
  const deletedDrawIds = extractDeletedDrawIds(methods);
  if (!deletedDrawIds.length) return;

  const active = getActiveDrawRoute();
  if (!active || !deletedDrawIds.includes(active.drawId)) return;

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (!drawsView) return;

  clearActiveDrawDeletedBanner();
  const banner = buildInlineNotice({
    intent: 'warning',
    message: t('draw.deletedByAnother', { defaultValue: 'The draw you were viewing was removed by another user.' }),
    action: {
      label: t('common.returnToEvent', { defaultValue: 'Return to event' }),
      onClick: () => navigateToEvent({ eventId: active.eventId }),
    },
    onDismiss: () => clearActiveDrawDeletedBanner(),
  });
  activeDrawDeletedBanner = banner;
  drawsView.insertBefore(banner, drawsView.firstChild);
}

/** Surface the sync indicator in "stale" mode — the staleness probe found the
 * server ahead of the local copy. Clicking the icon pulls the fresh record. */
export function markStaleNeedsRefresh(tournamentId: string): void {
  staleRefreshTournamentId = tournamentId;
  showSyncIndicator();
}

/** True when the local copy is known to be behind the server (icon in stale
 * mode). Mutations are blocked while this is true so a director can't act on
 * stale data — they must click the refresh icon first. */
export function isSyncStale(): boolean {
  return !!staleRefreshTournamentId;
}

/** Pull the latest tournament record from the server and apply it locally. Only
 * invoked on an explicit sync-icon click, so the full record is fetched on
 * demand — never on a background poll. */
async function refreshTournamentFromServer(tournamentId: string): Promise<void> {
  try {
    const result: any = await requestTournament({ tournamentId });
    const serverRecord = result?.data?.tournamentRecords?.[tournamentId];
    if (!serverRecord) return;

    const factoryEngine: any = factory[TOURNAMENT_ENGINE];
    factoryEngine.setState(serverRecord);
    notifyMutationApplied();
    await saveTournamentRecord();
    joinTournamentRoom(tournamentId);

    if (context.refreshActiveTable) context.refreshActiveTable();
  } catch (err) {
    console.warn('[syncIndicator] stale refresh failed:', err);
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
      const staleId = staleRefreshTournamentId;
      clearSyncIndicator();
      if (staleId) {
        slog('[syncIndicator] clicked — pulling fresh record (stale)');
        void refreshTournamentFromServer(staleId);
      } else if (context.refreshActiveTable) {
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

  // A remote mutation just changed local engine state — drop page-level
  // factory-read caches (e.g. the schedule2 matchUp cache) BEFORE the
  // in-place refresh below, otherwise refreshActiveTable() re-reads the stale
  // cache and the remote change (e.g. another director's score) never paints.
  // Same central notification the local mutationRequest path fires.
  notifyMutationApplied();

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

  // If a draw the user is currently viewing was just deleted remotely, surface
  // an inline banner with a path back to the event (draws-only, Phase 2).
  reactToActiveDrawDeletion(methods);
}
