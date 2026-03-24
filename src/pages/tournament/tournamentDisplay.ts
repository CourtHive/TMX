/**
 * Main tournament display router and loader.
 * Handles tournament loading, navigation, and tab rendering.
 */
import { renderPublishingTab } from 'pages/tournament/tabs/publishingTab/renderPublishingTab';
import { formatParticipantTab } from 'pages/tournament/tabs/participantTab/participantsTab';
import { renderSettingsTab } from 'pages/tournament/tabs/settingsTab/renderSettingsTab';
import { renderSchedule2Tab } from 'pages/tournament/tabs/schedule2Tab/schedule2Tab';
import { renderScheduleTab } from 'pages/tournament/tabs/scheduleTab/scheduleTab';
import { renderMatchUpTab } from 'pages/tournament/tabs/matchUpsTab/matchUpsTab';
import { tournamentHeader } from '../../components/popovers/tournamentHeader';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { clearChat } from 'services/chat/chatService';
import { renderVenueTab } from 'pages/tournament/tabs/scheduleTab/venuesTab';
import { renderEventsTab } from 'pages/tournament/tabs/eventsTab/eventsTab';
import { renderOverview } from './tabs/overviewTab/renderOverview';
import { getLoginState } from 'services/authentication/loginState';
import { showContent } from 'services/transitions/screenSlaver';
import { requestTournament } from 'services/apis/servicesApi';
import { tournamentEngine } from 'tods-competition-factory';
import { displayTab } from './container/tournamentContent';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderTopologyPage } from './topologyPage';
import { tmx2db } from 'services/storage/tmx2db';
import { debugConfig } from 'config/debugConfig';
import { context } from 'services/context';
import { highlightTab } from 'navigation';
import { t } from 'i18n';

// constants
import { LEAVE_TOURNAMENT } from 'constants/comsConstants';
import {
  joinTournamentRoom,
  leaveTournamentRoom,
  hadDisconnect,
  clearDisconnectFlag,
} from 'services/messaging/socketIo';
import {
  MATCHUPS_TAB,
  PARTICIPANTS,
  PUBLISHING_TAB,
  SCHEDULE_TAB,
  SCHEDULE2_TAB,
  SYNC_INDICATOR,
  TOURNAMENT,
  VENUES_TAB,
  EVENTS_TAB,
  TOURNAMENT_OVERVIEW,
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
    tmx2db
      .findTournament(config.tournamentId)
      .then((tournamentRecord: any) => loadTournament({ tournamentRecord, config }));
  }
}

function renderTournament({ config }: { config: any }): void {
  showContent(TOURNAMENT);
  tournamentHeader();
  highlightTab(config.selectedTab);
  routeTo(config);

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
}

export function routeTo(config: any): void {
  const { selectedTab = TOURNAMENT_OVERVIEW } = config;

  // Topology page is standalone — does not use tournament tab system
  if (selectedTab === 'topology') {
    highlightTab(selectedTab);
    renderTopologyPage({
      eventId: config.eventId,
      drawId: config.drawId,
      readOnly: config.readOnly,
    });
    return;
  }

  // Ensure TMX_CONTENT is visible (e.g. when navigating back from topology page)
  showContent(TOURNAMENT);
  highlightTab(selectedTab);

  if (displayTab(selectedTab)) {
    if (selectedTab === PARTICIPANTS) formatParticipantTab({ participantView: config.participantView });
    if (selectedTab === SCHEDULE_TAB) renderScheduleTab({ scheduledDate: config.scheduledDate });
    if (selectedTab === SCHEDULE2_TAB)
      renderSchedule2Tab({ scheduledDate: config.scheduledDate, scheduleView: config.scheduleView });
    if (selectedTab === TOURNAMENT_OVERVIEW) renderOverview();
    if (selectedTab === EVENTS_TAB) renderEventsTab(config);
    if (selectedTab === MATCHUPS_TAB) renderMatchUpTab();
    if (selectedTab === VENUES_TAB) renderVenueTab({ venueView: config.venueView });
    if (selectedTab === PUBLISHING_TAB) renderPublishingTab();
    if (selectedTab === SETTINGS_TAB) renderSettingsTab();
  }
}

export function loadTournament({ tournamentRecord, config }: { tournamentRecord?: any; config: any }): void {
  // Clear per-tournament transient state
  context.matchUpFilters = {};
  clearChat();

  const state = getLoginState();
  const provider = state?.provider || context?.provider;

  const notFound = () => {
    tmxToast({
      message: t('toasts.tournamentNotFound'),
      onClose: () => {
        context.router?.navigate('/tournaments');
      },
      intent: 'is-warning',
      pauseOnHover: true,
    });
  };

  const showResult = (result: any) => {
    const tournamentRecord = result?.data?.tournamentRecords?.[config.tournamentId];
    if (tournamentRecord) {
      tournamentEngine.setState(tournamentRecord);
      renderTournament({ config });
    } else {
      notFound();
    }
  };

  if (provider) {
    const tryLocal = () => {
      if (tournamentRecord) {
        tournamentEngine.setState(tournamentRecord);
        renderTournament({ config });
      } else {
        notFound();
      }
    };

    if (config.tournamentId) {
      const offline = tournamentRecord?.timeItems?.find(({ itemType }: any) => itemType === 'TMX')?.itemValue?.offline;
      if (offline) return tryLocal();
      requestTournament({ tournamentId: config.tournamentId }).then(showResult, tryLocal);
    }
  } else {
    tournamentEngine.setState(tournamentRecord);
    renderTournament({ config });
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

      const localRecord = tournamentEngine.getTournament()?.tournamentRecord;
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
