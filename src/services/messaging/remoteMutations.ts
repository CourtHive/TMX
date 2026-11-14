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
import { captureTournamentOperation, markTournamentRecordInstalled } from 'services/tournament/operationOwnership';
import { notifyRemoteScoringCollision } from 'services/transitions/activeScoringGuard';
import { advanceServerSync, setServerSync } from 'services/staleness/serverSync';
import { extractDeletedDrawIds } from 'services/scheduling/drawExistenceGuard';
import { getSessionIdentity } from 'services/authentication/sessionIdentity';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { resumeCommands } from 'services/messaging/transport/httpCommands';
import { buildInlineNotice } from 'components/notices/inlineNotice';
import { isOwnMutation } from 'services/messaging/clientIdentity';
import { requestTournament } from 'services/apis/servicesApi';
import { tmxToast } from 'services/notifications/tmxToast';
import * as factory from 'tods-competition-factory';
import { debugConfig } from 'config/debugConfig';
import { context } from 'services/context';
import { t } from 'i18n';
import {
  canInstallAuthoritativeSnapshot,
  canRefreshOnRequest,
  hasRecoverySurface,
} from 'services/staleness/authoritativeRecovery';
import {
  notifyMutationApplied,
  onAuthoritativeRefreshRequired,
  onMutationApplied,
} from 'services/mutation/mutationObservers';
import {
  onTournamentMutation,
  onTournamentReplaced,
  joinTournamentRoom,
  onDurableRecovery,
} from 'services/messaging/socketIo';

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
let stopRefreshObserver: (() => void) | undefined;
let stopDurableRecoveryObserver: (() => void) | undefined;
let stopGenerationObserver: (() => void) | undefined;
/** Bumped by every change applied to the engine. A record fetched across a bump may be older than the engine. */
let appliedGeneration = 0;
export function initRemoteMutationHandler(): void {
  slog('[remoteMutation] handler registered');
  onTournamentMutation(handleRemoteMutation);
  onTournamentReplaced(handleTournamentReplaced);
  stopRefreshObserver?.();
  stopDurableRecoveryObserver?.();
  stopGenerationObserver?.();
  stopGenerationObserver = onMutationApplied(() => appliedGeneration++);
  // A local result the server's answer cannot be applied to, and a durable command recovered with an
  // uncertain local state, both leave the local copy unproven: pull the authoritative record.
  const markIfViewing = (ids: string[]) => {
    const id = factory[TOURNAMENT_ENGINE].getTournamentId();
    if (id && ids.includes(id)) markStaleNeedsRefresh(id);
  };
  stopRefreshObserver = onAuthoritativeRefreshRequired(markIfViewing);
  stopDurableRecoveryObserver = onDurableRecovery(markIfViewing);
}

/** Hide the sync indicator (called on navigation). */
export function clearSyncIndicator(): void {
  staleRefreshTournamentId = undefined;
  clearActiveDrawDeletedBanner();
  const el = document.getElementById(SYNC_INDICATOR);
  if (el) {
    el.style.display = 'none';
    el.classList.remove('sync-indicator--active');
    el.title = '';
  }
}

/**
 * A tab change hides what belonged to the page being left (the "updates arrived" hint, a deleted-draw banner) but is
 * not a refresh: a copy known to be behind stays marked stale, its writes stay blocked, and the indicator stays until
 * the record is pulled (planning/TMX_CHECK_IN_INTENTS_AND_RECONNECT.md: "keep stale writes blocked during recovery").
 */
export function clearSyncIndicatorForNavigation(): void {
  if (isSyncStale()) return clearActiveDrawDeletedBanner();
  clearSyncIndicator();
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
 * server ahead of the local copy. Clicking the icon pulls the fresh record; a surface
 * that opted in to automatic recovery has it pulled for it once that is safe. */
export function markStaleNeedsRefresh(tournamentId: string, { recover = true }: { recover?: boolean } = {}): void {
  staleRefreshTournamentId = tournamentId;
  showSyncIndicator();
  if (recover) recoverIfSafe();
}

let recovering = false;
let recoverAgain = false;

/**
 * Option B (planning/TMX_CHECK_IN_INTENTS_AND_RECONNECT.md): pull and install the record without a click, when the
 * surface on screen opted in and nothing would be lost (`canInstallAuthoritativeSnapshot`). Otherwise the stale
 * indicator stays and says why it waits; the surface calls this again once its draft or pending gesture settles.
 *
 * Signals coalesce: one recovery at a time, and a request that arrives during it runs once more afterwards.
 * Mutations stay blocked (`isSyncStale`) until the install clears the indicator.
 */
export function recoverIfSafe(): void {
  const tournamentId = staleRefreshTournamentId;
  if (!tournamentId || tournamentId !== factory[TOURNAMENT_ENGINE].getTournamentId()) return;
  if (recovering) {
    recoverAgain = true;
    return;
  }
  if (!canInstallAuthoritativeSnapshot()) return explainRecoveryWaiting();
  recovering = true;
  void refreshTournamentFromServer(tournamentId, { guard: canInstallAuthoritativeSnapshot })
    .then((outcome) => {
      if (outcome === 'blocked') explainRecoveryWaiting();
    })
    .finally(() => {
      recovering = false;
      if (!recoverAgain) return;
      recoverAgain = false;
      recoverIfSafe();
    });
}

/** A refresh the operator asked for would discard a draft or overtake a command: nothing is installed, and they are told why. */
function refuseManualRefresh(): void {
  const el = document.getElementById(SYNC_INDICATOR);
  if (el) el.title = t('remoteMutations.refreshWaiting');
  tmxToast({ message: t('remoteMutations.refreshBlocked'), intent: 'is-warning' });
}

/** Only where recovery would otherwise have run: everywhere else the indicator means "click to refresh", as before. */
function explainRecoveryWaiting(): void {
  if (!hasRecoverySurface()) return;
  const el = document.getElementById(SYNC_INDICATOR);
  if (el) el.title = t('remoteMutations.refreshWaiting');
}

/** True when the local copy is known to be behind the server (icon in stale
 * mode). Mutations are blocked while this is true so a director can't act on
 * stale data — they must click the refresh icon first. */
export function isSyncStale(): boolean {
  if (staleRefreshTournamentId && staleRefreshTournamentId !== factory[TOURNAMENT_ENGINE].getTournamentId()) {
    clearSyncIndicator();
  }
  return !!staleRefreshTournamentId;
}

/** The server replaced the record outside `executionQueue` — today only a super-admin moving the tournament to
 * another provider (CA's D4, 2026-11-07). There are no methods to replay, and acting on the old copy would mutate a
 * tournament whose ownership changed underneath it, so mark it stale (mutations are blocked) and pull the record now.
 * If this director has lost access in the move, the pull fails and the copy stays blocked rather than forking. */
export function handleTournamentReplaced(data: { tournamentId?: string; reason?: string } | undefined): void {
  const tournamentId = data?.tournamentId;
  if (!tournamentId || factory[TOURNAMENT_ENGINE].getTournamentId() !== tournamentId) return;
  slog('[tournamentReplaced] reloading', tournamentId, data?.reason);
  markStaleNeedsRefresh(tournamentId, { recover: false });
  tmxToast({ message: t('remoteMutations.tournamentReplaced'), intent: 'is-info' });
  void refreshTournamentFromServer(tournamentId);
}

export type RefreshOutcome = 'installed' | 'blocked' | 'obsolete' | 'failed';

/** A record fetched while changes keep landing is fetched again, this many times at most. */
const MAX_REFRESH_ATTEMPTS = 3;

/** Pull the latest tournament record from the server and apply it locally. Invoked on an
 * explicit click (the sync icon, or a save-conflict toast's action), when the server says
 * the record was replaced, or by `recoverIfSafe` — never on a background poll.
 *
 * `guard` is checked again once the record has arrived: a draft begun during the fetch wins,
 * and the install does not happen. A change applied to the engine during the fetch (an ack
 * or a broadcast) may be newer than the fetched record, so that record is discarded and
 * fetched again rather than allowed to roll the engine back. */
export async function refreshTournamentFromServer(
  tournamentId: string,
  { guard }: { guard?: () => boolean } = {},
): Promise<RefreshOutcome> {
  // Detach when the operation stops being this tab's: another tournament, another installed copy, another identity.
  const ownsRecord = captureTournamentOperation([tournamentId]);
  const identity = getSessionIdentity();
  const isCurrent = () => ownsRecord() && getSessionIdentity() === identity;
  try {
    for (let attempt = 0; attempt < MAX_REFRESH_ATTEMPTS; attempt++) {
      const generation = appliedGeneration;
      const result: any = await requestTournament({ tournamentId });
      const serverRecord = result?.data?.tournamentRecords?.[tournamentId];
      if (!isCurrent()) return 'obsolete';
      if (!serverRecord) return 'failed';
      if (guard && !guard()) return 'blocked';
      if (generation !== appliedGeneration) continue;

      const factoryEngine: any = factory[TOURNAMENT_ENGINE];
      const applied = factoryEngine.setState(serverRecord);
      if (applied?.error) return 'failed';
      markTournamentRecordInstalled();
      // Commands held behind one that went unanswered may go now: whatever that one did is in this record, and
      // anything sent from here on is written against it. A connected desk would otherwise wait for a reconnect.
      resumeCommands();
      if (staleRefreshTournamentId === tournamentId) clearSyncIndicator();
      setServerSync(tournamentId, result?.data?.serverUpdatedAt?.[tournamentId]);
      notifyMutationApplied();
      await saveTournamentRecord();
      joinTournamentRoom(tournamentId);

      if (context.refreshActiveTable) context.refreshActiveTable();
      return 'installed';
    }
    return 'failed';
  } catch (err) {
    console.warn('[syncIndicator] stale refresh failed:', err);
    return 'failed';
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
      const staleId = isSyncStale() ? staleRefreshTournamentId : undefined;
      if (!staleId) clearSyncIndicator();
      if (staleId) {
        // The operator chose to load, but never over a draft or a command still in flight: the same protection as
        // automatic recovery, rechecked when the record arrives.
        if (!canRefreshOnRequest()) return refuseManualRefresh();
        slog('[syncIndicator] clicked — pulling fresh record (stale)');
        void refreshTournamentFromServer(staleId, { guard: canRefreshOnRequest }).then((outcome) => {
          if (outcome === 'blocked') refuseManualRefresh();
        });
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

  if (!tournamentIds?.length) return;

  // Our own mutation coming back. Socket.IO never sends it (the server excludes the sender), but a
  // transport that cannot exclude a connection would, and applying it twice would double it.
  if (isOwnMutation(data)) {
    slog('[remoteMutation] skipped — originated in this tab');
    return;
  }

  // A command whose every directive was a presence intention already satisfied: the server saved, so its write
  // time moved, but there is nothing to apply. Without this step every desk that was current would look behind
  // and pull the whole record. A desk that was already behind stays behind (P49), and the probe still says so.
  if (!methods?.length) {
    advanceServerSync(data.previousServerUpdatedAt, data.serverUpdatedAt);
    return;
  }

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
    tmxToast({ message: t('remoteMutations.updateFailed'), intent: 'is-warning' });
    return;
  }

  // Applied: this copy now holds the server's write. If it had missed an earlier one, its sync point
  // does not move, and the staleness probe will say so (P49).
  advanceServerSync(data.previousServerUpdatedAt, data.serverUpdatedAt);

  // A remote mutation just changed local engine state — drop page-level
  // factory-read caches (e.g. the schedule2 matchUp cache) BEFORE the
  // in-place refresh below, otherwise refreshActiveTable() re-reads the stale
  // cache and the remote change (e.g. another director's score) never paints.
  // Same central notification the local mutationRequest path fires.
  notifyMutationApplied();

  // If this broadcast scored the matchUp the director is currently entering a
  // score for, warn them (with the colleague's just-applied score) so their save
  // can't silently overwrite it — the engine now holds the remote result.
  const affectedMatchUpIds = methods.flatMap((m: any) => {
    const p = m?.params ?? {};
    return [p.matchUpId, ...(Array.isArray(p.matchUpIds) ? p.matchUpIds : [])].filter(Boolean);
  });
  if (affectedMatchUpIds.length) notifyRemoteScoringCollision(affectedMatchUpIds);

  // Persist to IndexedDB
  await saveTournamentRecord();

  // Refresh the active view in-place — UNLESS a scoring modal is open. A
  // destroy+rebuild refresher (e.g. the round-robin bracket) would replace the
  // table instance the open modal's save callback closes over, and
  // mutationRequest does not re-render on its own — so the director's own score
  // could land in the engine without repainting until the next refresh. While
  // they're actively scoring, defer: surface the sync indicator so they can pull
  // the update after finishing. The engine already holds the applied change, so
  // nothing is lost, and the entered score in the (body-level) modal is untouched.
  const scoringModalOpen = typeof document !== 'undefined' && !!document.querySelector('.cModal');
  if (context.refreshActiveTable && !scoringModalOpen) {
    slog('[remoteMutation] refreshing active table in-place');
    context.refreshActiveTable();
  } else {
    slog('[remoteMutation] deferring refresh — %s', scoringModalOpen ? 'scoring modal open' : 'no active table');
    showSyncIndicator();
  }

  // Emit a local event so the active view can optionally react
  context.ee.emit('remoteMutation', { methods, tournamentIds });

  // If a draw the user is currently viewing was just deleted remotely, surface
  // an inline banner with a path back to the event (draws-only, Phase 2).
  reactToActiveDrawDeletion(methods);
}
