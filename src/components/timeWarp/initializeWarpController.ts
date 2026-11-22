/** Application composition: clock, auth and chrome adapt the page-independent Warp lifecycle. */
import { captureTournamentOperation, markTournamentRecordInstalled } from 'services/tournament/operationOwnership';
import { hasUnsavedChanges, isAvailabilityDirty, resetQueue } from 'services/schedulingWorkspace/queueService';
import { onNetworkRefusal, serverRequestEpoch, isNetworkIsolationError } from 'services/network/networkPolicy';
import { clearDemoOverlay, getDemoOverlay, setDemoOverlay } from 'services/demoMode/demoState';
import { clearDemoWalkthrough, stopDemoWalkthrough } from 'services/clock/demoWalkthrough';
import { unsettledCommandCount, ensureConnected } from 'services/messaging/socketIo';
import { clearActiveLiveTrackedScores } from 'services/messaging/liveTrackedScores';
import { storeWarpReturn, clearWarpReturn } from 'services/timeWarp/warpReturnPath';
import { isHeldOffline, visibleToSession } from 'services/storage/offlineCustody';
import { stopTournamentCrowdPoller } from 'services/crowd/tournamentCrowdPoller';
import { initializeTimeWarp, exitTimeWarp } from 'services/timeWarp/timeWarp';
import { getSessionIdentity } from 'services/authentication/sessionIdentity';
import { clearUserContext } from 'services/authentication/getUserContext';
import { isScoringActive } from 'services/transitions/activeScoringGuard';
import { renderDemoAffordance } from 'services/demoMode/demoAffordance';
import { clearSyncIndicator } from 'services/messaging/remoteMutations';
import { resetActivityTimer } from 'services/staleness/stalenessGuard';
import { warpExitPath } from 'components/demoClock/warpClockRange';
import { clearActiveProvider } from 'services/provider/providerState';
import { getLoginState } from 'services/authentication/loginState';
import { getToken } from 'services/authentication/tokenManagement';
import { disconnectRelay } from 'services/messaging/scoreRelay';
import { closeAmsChat } from 'services/chat/amsChatTransport';
import { getWarpSession } from 'services/timeWarp/warpState';
import { getJwtTokenStorageKey } from 'config/localStorage';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { venueTimeZone } from 'functions/venueTimeFrame';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { t } from 'i18n';
import {
  noteLoadedTournament,
  setDemoClockTime,
  stopDemoClock,
  getDemoClock,
  forgetDemoClockHistory,
} from 'services/clock/demoClock';

const TOURNAMENTS_PATH = '/tournaments';
const WARNING_INTENT = 'is-warning';

/**
 * Exit Warp stays on the page being looked at, now showing the original tournament (CA 2026-11-22); a page about
 * something made only in the sandbox steps up to what the original has. A warp of an example record has no original,
 * so it returns where the warp began.
 */
function exitPath(session: any): string {
  return (
    warpExitPath({
      current: globalThis.location.hash,
      copyId: session.tournamentId,
      sourceId: session.sourceId,
      record: session.sourceRecord,
    }) ?? session.returnPath
  );
}

export function initializeWarpController(): () => void {
  const dispose = initializeTimeWarp({
    path: () => globalThis.location.hash.replace(/^#/, '') || TOURNAMENTS_PATH,
    ready: () =>
      !hasUnsavedChanges() &&
      !isAvailabilityDirty() &&
      !isScoringActive() &&
      !unsettledCommandCount() &&
      !getDemoClock()?.busy,
    refused: () => tmxToast({ message: t('timeWarp.finishFirst'), intent: WARNING_INTENT }),
    prepare: () => import('components/demoClock/demoClockPanel'),
    capture: ({ record }) => {
      if (!record && (!tournamentEngine.q.tournamentInfo()?.startDate || !venueTimeZone())) {
        tmxToast({ message: t('demoClock.cannotStart'), intent: WARNING_INTENT });
        return undefined;
      }
      const loginState = getLoginState();
      if (getToken() && !loginState) return undefined;
      const overlay = getDemoOverlay();
      return {
        loginState,
        identity: getSessionIdentity(),
        initialTime: getDemoClock()?.nowMs ?? Date.now(),
        overlay: overlay && !overlay.transient ? structuredClone(overlay) : undefined,
        selectedScheduleDate: context.displayed.selectedScheduleDate,
        viewState: structuredClone({
          matchUpFilters: context.matchUpFilters,
          participantFilters: context.participantFilters,
          scheduleCatalogState: context.scheduleCatalogState,
        }),
      };
    },
    beforeEnter: stopDemoClock,
    entered: (session, options, prepared: any, copy) => {
      storeWarpReturn(session.returnPath, session.overlay);
      closeAmsChat();
      disconnectRelay();
      stopTournamentCrowdPoller();
      clearActiveLiveTrackedScores();
      resetQueue();
      clearSyncIndicator();
      noteLoadedTournament(copy);
      document.documentElement.dataset.tmxTimeWarp = 'true';
      // the badge beside the title becomes "Time Warp" whether or not a demo posture was already on
      renderDemoAffordance();
      resetActivityTimer();
      if (session.mode === 'clock') setDemoClockTime(session.initialTime, 'clock');
      context.router?.navigate(
        options.record
          ? `/tournament/${copy.tournamentId}/scheduling`
          : session.returnPath.replace(`/tournament/${session.sourceId}`, `/tournament/${copy.tournamentId}`),
      );
      prepared.openDemoClockPanel(session.mode);
    },
    beforeExit: (session) => {
      stopDemoWalkthrough('clock-exit');
      stopDemoClock();
      forgetDemoClockHistory(session.tournamentId);
      noteLoadedTournament({ tournamentId: session.tournamentId });
    },
    restored: async (session, { navigate = true, resume = true }, complete) => {
      resetQueue();
      context.displayed.selectedScheduleDate = session.selectedScheduleDate;
      if (session.viewState) Object.assign(context, session.viewState);
      if (session.overlay) setDemoOverlay(session.overlay);
      else clearDemoOverlay();
      delete document.documentElement.dataset.tmxTimeWarp;
      clearWarpReturn();
      renderDemoAffordance();
      clearSyncIndicator();
      resetActivityTimer();
      if (!navigate) {
        complete();
        return;
      }
      const online =
        session.loginState &&
        session.sourceRecord?.parentOrganisation?.organisationId &&
        !isHeldOffline(session.sourceRecord);
      const finish = () => {
        complete();
        if (resume) ensureConnected();
        context.router?.navigate(exitPath(session));
      };
      if (online) {
        tournamentEngine.reset();
        finish();
        return;
      }
      // IndexedDB is authoritative for offline custody: pick up another tab's committed local edits, never overwrite
      // them with the entry snapshot. An original that existed only in memory still uses its captured snapshot.
      const owns = captureTournamentOperation(session.sourceId ? [session.sourceId] : []);
      if (!session.sourceId) {
        finish();
        return;
      }
      const record = await tmx2db.findTournament(session.sourceId);
      if (getWarpSession() !== session || getSessionIdentity() !== session.identity) return;
      if (owns() && record && visibleToSession(record)) {
        tournamentEngine.setState({ ...session.sourceState.tournamentRecords, [session.sourceId]: record });
        tournamentEngine.setTournamentId(session.sourceId);
        markTournamentRecordInstalled();
      }
      // A superseded read cannot install data, but must still release isolation and allow navigation.
      finish();
    },
    failed: (session, error) => {
      console.warn('[timeWarp] exit recovered after a restoration failure', error);
      stopDemoClock();
      delete document.documentElement.dataset.tmxTimeWarp;
      clearWarpReturn();
      if (session.overlay) setDemoOverlay(session.overlay);
      else clearDemoOverlay();
      renderDemoAffordance();
      tmxToast({ message: t('timeWarp.exitRecovered'), intent: WARNING_INTENT });
      context.router?.navigate(exitPath(session));
    },
  });
  const identityChanged = (event: StorageEvent) => {
    const session = getWarpSession();
    if (
      !session ||
      (event.key !== null && event.key !== getJwtTokenStorageKey()) ||
      session.identity === getSessionIdentity()
    )
      return;
    exitTimeWarp({ navigate: false, resume: false });
    clearDemoWalkthrough();
    clearDemoOverlay();
    clearUserContext();
    clearActiveProvider();
    tournamentEngine.reset();
    context.router?.navigate(TOURNAMENTS_PATH);
  };
  let reportedEpoch = -1;
  const stopRefusalNotice = onNetworkRefusal((error) => {
    if (error.reason === 'stale' || reportedEpoch === serverRequestEpoch()) return;
    reportedEpoch = serverRequestEpoch();
    tmxToast({
      message: t(error.reason === 'sandbox-id' ? 'networkIsolation.reservedId' : 'networkIsolation.blocked'),
      intent: WARNING_INTENT,
    });
  });
  const isolatedRequest = (event: PromiseRejectionEvent) => {
    if (isNetworkIsolationError(event.reason)) event.preventDefault();
  };
  globalThis.addEventListener('storage', identityChanged);
  globalThis.addEventListener('unhandledrejection', isolatedRequest);
  return () => {
    stopRefusalNotice();
    globalThis.removeEventListener('storage', identityChanged);
    globalThis.removeEventListener('unhandledrejection', isolatedRequest);
    dispose();
  };
}
