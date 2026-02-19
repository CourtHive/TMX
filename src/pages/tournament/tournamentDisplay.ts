/**
 * Main tournament display router and loader.
 * Handles tournament loading, navigation, and tab rendering.
 */
import { formatParticipantTab } from 'pages/tournament/tabs/participantTab/participantsTab';
import { renderScheduleTab } from 'pages/tournament/tabs/scheduleTab/scheduleTab';
import { renderMatchUpTab } from 'pages/tournament/tabs/matchUpsTab/matchUpsTab';
import { tournamentHeader } from '../../components/popovers/tournamentHeader';
import { renderVenueTab } from 'pages/tournament/tabs/scheduleTab/venuesTab';
import { renderEventsTab } from 'pages/tournament/tabs/eventsTab/eventsTab';
import { renderOverview } from './tabs/overviewTab/renderOverview';
import { getLoginState } from 'services/authentication/loginState';
import { showContent } from 'services/transitions/screenSlaver';
import { requestTournament } from 'services/apis/servicesApi';
import { tournamentEngine } from 'tods-competition-factory';
import { displayTab } from './container/tournamentContent';
import { tmxToast } from 'services/notifications/tmxToast';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { highlightTab } from 'navigation';

import { LEAVE_TOURNAMENT } from 'constants/comsConstants';
import {
  MATCHUPS_TAB,
  PARTICIPANTS,
  SCHEDULE_TAB,
  TOURNAMENT,
  VENUES_TAB,
  EVENTS_TAB,
  TOURNAMENT_OVERVIEW,
} from 'constants/tmxConstants';

export function displayTournament({ config }: { config?: any } = {}): void {
  const { tournamentRecord } = tournamentEngine.getTournament();
  if (tournamentRecord?.tournamentId === config.tournamentId) {
    routeTo(config);
  } else {
    context.ee.emit(LEAVE_TOURNAMENT, (context as any).tournamentId);
    tmx2db.findTournament(config.tournamentId).then((tournamentRecord: any) => loadTournament({ tournamentRecord, config }));
  }
}

function renderTournament({ config }: { config: any }): void {
  showContent(TOURNAMENT);
  tournamentHeader();
  highlightTab(config.selectedTab);
  routeTo(config);
}

export function routeTo(config: any): void {
  const { selectedTab = PARTICIPANTS } = config;
  if (displayTab(selectedTab)) {
    if (selectedTab === PARTICIPANTS) formatParticipantTab({ participantView: config.participantView });
    if (selectedTab === SCHEDULE_TAB) renderScheduleTab({ scheduledDate: config.scheduledDate });
    if (selectedTab === TOURNAMENT_OVERVIEW) renderOverview();
    if (selectedTab === EVENTS_TAB) renderEventsTab(config);
    if (selectedTab === MATCHUPS_TAB) renderMatchUpTab();
    if (selectedTab === VENUES_TAB) renderVenueTab();
  }
}

export function loadTournament({ tournamentRecord, config }: { tournamentRecord?: any; config: any }): void {
  const state = getLoginState();
  const provider = state?.provider || context?.provider;

  const notFound = () => {
    tmxToast({
      message: 'Tournament not found',
      onClose: () => {
        context.router.navigate('/tournaments');
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
