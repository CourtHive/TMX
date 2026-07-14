/**
 * Main tournament display router and loader.
 * Handles tournament loading, navigation, and tab rendering.
 */
import { renderSchedulingTab, destroySchedulingTab } from 'pages/tournament/tabs/schedulingTab/schedulingTab';
import { renderRegistrationsTab } from 'pages/tournament/tabs/registrationsTab/renderRegistrationsTab';
import { renderPublishingTab } from 'pages/tournament/tabs/publishingTab/renderPublishingTab';
import { formatParticipantTab } from 'pages/tournament/tabs/participantTab/participantsTab';
import { runActiveScaleAutoSwitch } from 'services/activeScale/runActiveScaleAutoSwitch';
import { renderSettingsTab } from 'pages/tournament/tabs/settingsTab/renderSettingsTab';
import { renderReportsTab } from 'pages/tournament/tabs/reportsTab/renderReportsTab';
import { renderMatchUpTab } from 'pages/tournament/tabs/matchUpsTab/matchUpsTab';
import { requestTournament, removeTournament } from 'services/apis/servicesApi';
import { tournamentHeader } from '../../components/popovers/tournamentHeader';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { renderEventsTab } from 'pages/tournament/tabs/eventsTab/eventsTab';
import { renderVenueTab } from 'pages/tournament/tabs/venuesTab/venuesTab';
import { renderOverview } from './tabs/overviewTab/renderOverview';
import { getLoginState } from 'services/authentication/loginState';
import { maybeNudgeActiveDates } from './maybeNudgeActiveDates';
import { showContent } from 'services/transitions/screenSlaver';
import { factoryConstants } from 'tods-competition-factory';
import { renderFormatWizardPage } from './formatWizardPage';
import { tournamentEngine } from 'services/factory/engine';
import { displayTab } from './container/tournamentContent';
import { tmxToast } from 'services/notifications/tmxToast';
import { clearChat } from 'services/chat/chatService';
import { renderTopologyPage } from './topologyPage';
import { tmx2db } from 'services/storage/tmx2db';
import { debugConfig } from 'config/debugConfig';
import { context } from 'services/context';
import { notifyTournamentContextChanged } from 'services/tournament/tournamentContextObservers';
import { highlightTab } from 'navigation';
import { t } from 'i18n';

// constants
import { connectRelay, disconnectRelay, onTournamentScore } from 'services/messaging/scoreRelay';
import { LEAVE_TOURNAMENT } from 'constants/comsConstants';
import {
  joinTournamentRoom,
  leaveTournamentRoom,
  hadDisconnect,
  clearDisconnectFlag,
} from 'services/messaging/socketIo';
import {
  loadCrowdsourcedScores,
  markMatchUpCrowdsourced,
  pruneCompletedMatchUps,
  clearActiveCrowdsourcedScores,
} from 'services/messaging/crowdsourcedScores';
import {
  MATCHUPS_TAB,
  PARTICIPANTS,
  PUBLISHING_TAB,
  SCHEDULING_TAB,
  SYNC_INDICATOR,
  TOURNAMENT,
  VENUES_TAB,
  EVENTS_TAB,
  TOURNAMENT_OVERVIEW,
  REPORTS_TAB,
  REGISTRATIONS_TAB,
  SETTINGS_TAB,
} from 'constants/tmxConstants';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

export function displayTournament({ config }: { config?: any } = {}): void {
  const { tournamentRecord } = tournamentEngine.getTournament();
  if (tournamentRecord?.tournamentId === config.tournamentId) {
    // Tournament already loaded — check if we missed updates while disconnected
    if (hadDisconnect() && getLoginState()) {
      clearDisconnectFlag();
      checkForStaleData(config.tournamentId);
    }
    routeTo(config);
  } else {
    const prevId = (context as any).tournamentId;
    slog('[tournament] switching from %s to %s (loggedIn=%s)', prevId, config.tournamentId, !!getLoginState());
    context.ee.emit(LEAVE_TOURNAMENT, prevId);
    if (prevId && getLoginState()) leaveTournamentRoom(prevId);
    disconnectRelay();
    clearActiveCrowdsourcedScores();
    tmx2db
      .findTournament(config.tournamentId)
      .then((tournamentRecord: any) => loadTournament({ tournamentRecord, config }));
  }
}

export function renderTournament({ config }: { config: any }): void {
  // Announce the tournament switch before anything renders so per-tournament
  // caches (e.g. the schedule data cache) drop the previous tournament's
  // entries first. renderTournament runs only on an actual load/switch — not
  // on intra-tournament navigation — so this fires exactly once per switch.
  if (config.tournamentId) notifyTournamentContextChanged(config.tournamentId);

  showContent(TOURNAMENT);
  tournamentHeader();
  highlightTab(config.selectedTab);
  routeTo(config);

  // Suggest setting activeDates when the operator is mid-tournament,
  // matchUps are scheduled, and most days are empty. The helper is
  // idempotent per tournamentId for the page lifetime, so calling it
  // from every renderTournament (including tab navigations) is safe.
  const { tournamentRecord } = tournamentEngine.getTournament();
  if (tournamentRecord?.tournamentId === config.tournamentId) {
    maybeNudgeActiveDates({ tournamentRecord });
  }

  // Join the tournament room so we receive mutation broadcasts from other clients
  if (config.tournamentId && getLoginState()) {
    slog('[tournament] renderTournament — joining room for', config.tournamentId);
    joinTournamentRoom(config.tournamentId);
  } else {
    slog(
      '[tournament] renderTournament — skipping room join (tournamentId=%s, loggedIn=%s)',
      config.tournamentId,
      !!getLoginState(),
    );
  }

  // Connect to score relay for live scores from trackers
  if (config.tournamentId) {
    connectRelay(config.tournamentId);
    onTournamentScore(handleRelayScore);
    loadCrowdsourcedScores(config.tournamentId);
    pruneCompletedCrowdsourcedFromEngine();
  }
}

const COMPLETED_MATCH_UP_STATUSES = new Set<string>(factoryConstants.completedMatchUpStatuses);

/**
 * Read the engine's current matchUps, pick out the completed ones, and ask
 * the crowdsourced-score store to drop them. Called on tournament load and
 * after each relay score arrival so badges fall away as soon as a match
 * wraps up.
 */
function pruneCompletedCrowdsourcedFromEngine(): void {
  try {
    const { matchUps = [] } = tournamentEngine.allTournamentMatchUps() || {};
    const completedIds: string[] = [];
    for (const matchUp of matchUps as any[]) {
      const isComplete = matchUp.winningSide || COMPLETED_MATCH_UP_STATUSES.has(matchUp.matchUpStatus);
      if (isComplete && matchUp.matchUpId) completedIds.push(matchUp.matchUpId);
    }
    if (completedIds.length) pruneCompletedMatchUps(completedIds);
  } catch (err) {
    slog('[crowdsourced] prune failed', err);
  }
}

// Tracks the last rendered tab so routeTo() can tear down its long-lived
// subscriptions / intervals when the user navigates away. Without this,
// schedulingTab leaks its 30s activeStripBlockTicker plus store subscribers
// and keeps firing competitionScheduleMatchUps from a tab the user is no
// longer viewing.
let activeRenderedTab: string | null = null;

function destroyActiveTab(): void {
  if (activeRenderedTab === SCHEDULING_TAB) destroySchedulingTab();
  activeRenderedTab = null;
}

export function routeTo(config: any): void {
  const { selectedTab = TOURNAMENT_OVERVIEW } = config;

  // Topology page is standalone — does not use tournament tab system
  if (selectedTab === 'topology') {
    destroyActiveTab();
    highlightTab(selectedTab);
    renderTopologyPage({
      eventId: config.eventId,
      drawId: config.drawId,
      readOnly: config.readOnly,
    });
    return;
  }

  // Format Wizard is also standalone — full-page tournament-context
  // surface with no navbar icon. Launched from overview.
  if (selectedTab === 'format-wizard') {
    destroyActiveTab();
    renderFormatWizardPage();
    return;
  }

  // Ensure TMX_CONTENT is visible (e.g. when navigating back from topology page)
  showContent(TOURNAMENT);
  highlightTab(selectedTab);

  if (displayTab(selectedTab)) {
    // Tear down the previous tab's subscriptions before mounting the new one.
    // Same-tab re-renders are a no-op: each tab's renderer guards itself.
    if (activeRenderedTab && activeRenderedTab !== selectedTab) destroyActiveTab();

    if (selectedTab === PARTICIPANTS) formatParticipantTab({ participantView: config.participantView });
    if (selectedTab === SCHEDULING_TAB)
      renderSchedulingTab({ scheduledDate: config.scheduledDate, mode: config.schedulingMode });
    if (selectedTab === TOURNAMENT_OVERVIEW) renderOverview();
    if (selectedTab === EVENTS_TAB) renderEventsTab(config);
    if (selectedTab === MATCHUPS_TAB) renderMatchUpTab();
    if (selectedTab === VENUES_TAB) renderVenueTab({ venueView: config.venueView, venueId: config.venueId });
    if (selectedTab === REPORTS_TAB) renderReportsTab({ reportId: config.reportId });
    if (selectedTab === REGISTRATIONS_TAB) void renderRegistrationsTab();
    if (selectedTab === PUBLISHING_TAB) renderPublishingTab();
    if (selectedTab === SETTINGS_TAB) renderSettingsTab();

    activeRenderedTab = selectedTab;
  }
}

export function loadTournament({ tournamentRecord, config }: { tournamentRecord?: any; config: any }): void {
  // Clear per-tournament transient state
  context.matchUpFilters = {};
  context.scheduleCatalogState = undefined;
  clearChat();

  const state = getLoginState();
  const provider = state?.provider || context?.provider;

  const goToTournaments = () => context.router?.navigate('/tournaments');

  const notFound = () => {
    const providerId = (context?.provider || state?.provider)?.organisationId;
    const action = providerId
      ? {
          text: t('remove'),
          onClick: () => {
            removeTournament({ providerId, tournamentId: config.tournamentId }).then(goToTournaments, goToTournaments);
          },
        }
      : undefined;
    tmxToast({
      message: t('toasts.tournamentNotFound'),
      onClose: goToTournaments,
      intent: 'is-warning',
      pauseOnHover: true,
      duration: 8000,
      action,
    });
  };

  const showResult = (result: any) => {
    const tournamentRecord = result?.data?.tournamentRecords?.[config.tournamentId];
    if (tournamentRecord) {
      tournamentEngine.setState(tournamentRecord);
      runActiveScaleAutoSwitch();
      renderTournament({ config });
    } else {
      notFound();
    }
  };

  if (provider) {
    const tryLocal = () => {
      if (tournamentRecord) {
        tournamentEngine.setState(tournamentRecord);
        runActiveScaleAutoSwitch();
        renderTournament({ config });
      } else {
        notFound();
      }
    };

    if (config.tournamentId) {
      const offline = tournamentRecord?.timeItems?.find(({ itemType }: any) => itemType === 'TMX')?.itemValue?.offline;
      if (offline) return tryLocal();
      requestTournament({ tournamentId: config.tournamentId, silent: true }).then(showResult, tryLocal);
    }
  } else {
    // No provider context (logged out / local). If the record is missing — e.g. it was deleted
    // but a stale list/calendar entry got reopened — redirect to the list instead of calling
    // setState(undefined) and rendering an empty, record-less tournament view that traps the
    // whole nav (every tab renders empty and back-to-list is dead).
    if (!tournamentRecord) return notFound();
    tournamentEngine.setState(tournamentRecord);
    runActiveScaleAutoSwitch();
    renderTournament({ config });
  }
}

/**
 * Handle a live score arriving from the score relay.
 * Pulses the matchUp's score cell in any visible table and refreshes data.
 */
function handleRelayScore(data: any): void {
  slog('[relay] tournament score update:', data.matchUpId);
  markMatchUpCrowdsourced(data.matchUpId);
  pulseMatchUpScore(data.matchUpId);

  if (context.refreshActiveTable) {
    context.refreshActiveTable();
  }

  // The relay event itself may carry an already-complete matchUp (the
  // official submitted a final score), or the server mutation may have
  // landed between the relay broadcast and our handler. Sweep the
  // engine so completed matchUps lose their badge immediately.
  pruneCompletedCrowdsourcedFromEngine();
}

/**
 * Add a brief pulse animation to the score cell of the given matchUpId
 * in any active Tabulator table that uses matchUpId as its index.
 */
function pulseMatchUpScore(matchUpId: string): void {
  if (!context.tables) return;

  for (const table of Object.values(context.tables) as any[]) {
    if (!table?.getRow) continue;

    try {
      const row = table.getRow(matchUpId);
      if (!row) continue;

      const cell = row.getCell('score');
      if (!cell) continue;

      const el = cell.getElement();
      if (el) {
        el.classList.add('live-score-pulse');
        setTimeout(() => el.classList.remove('live-score-pulse'), 3000);
      }
    } catch {
      // Row doesn't exist in this table — skip
    }
  }
}

/**
 * After reconnecting from a disconnect, fetch the tournament from the server
 * and compare `updatedAt` to detect missed mutations.  If stale, reload the
 * server copy and show the sync indicator so the user knows data was refreshed.
 */
function checkForStaleData(tournamentId: string): void {
  slog('[tournament] checking for stale data after reconnect — tournamentId:', tournamentId);
  requestTournament({ tournamentId }).then(
    (result: any) => {
      const serverRecord = result?.data?.tournamentRecords?.[tournamentId];
      if (!serverRecord) {
        slog('[tournament] stale check — server returned no record');
        return;
      }

      const localRecord = tournamentEngine.q.tournament();
      const serverUpdated = serverRecord.updatedAt ? new Date(serverRecord.updatedAt).getTime() : 0;
      const localUpdated = localRecord?.updatedAt ? new Date(localRecord.updatedAt).getTime() : 0;

      slog(
        '[tournament] stale check — server updatedAt: %s, local updatedAt: %s',
        serverRecord.updatedAt,
        localRecord?.updatedAt,
      );

      if (serverUpdated > localUpdated) {
        slog('[tournament] local data is stale — reloading from server');
        tournamentEngine.setState(serverRecord);
        saveTournamentRecord();

        // Refresh the active table if one exists, otherwise show sync indicator
        if (context.refreshActiveTable) {
          context.refreshActiveTable();
        } else {
          const el = document.getElementById(SYNC_INDICATOR);
          if (el) {
            el.style.display = '';
            el.classList.add('sync-indicator--active');
          }
        }

        tmxToast({ message: 'Tournament data refreshed from server', intent: 'is-info' });
      } else {
        slog('[tournament] local data is up to date');
      }
    },
    (err: any) => {
      console.warn('[tournament] stale check failed:', err);
    },
  );
}
