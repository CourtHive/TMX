import { formatParticipantTab } from 'pages/tournament/tabs/participantTab/participantsTab';
import { removeProviderTournament } from 'services/storage/removeProviderTournament';
import { renderScheduleTab } from 'pages/tournament/tabs/scheduleTab/scheduleTab';
import { renderMatchUpTab } from 'pages/tournament/tabs/matchUpsTab/matchUpsTab';
import { tournamentHeader } from '../../components/popovers/tournamentHeader';
import { renderVenueTab } from 'pages/tournament/tabs/scheduleTab/venuesTab';
import { renderEventsTab } from 'pages/tournament/tabs/eventsTab/eventsTab';
import { renderOverview } from './tabs/overviewTab/renderOverview';
import { getLoginState } from 'services/authentication/loginState';
import { showContent } from 'services/transitions/screenSlaver';
import { tournamentEngine } from 'tods-competition-factory';
import { displayTab } from './container/tournamentContent';
import { tmxToast } from 'services/notifications/tmxToast';
import { getTournament } from 'services/apis/servicesApi';
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

export function displayTournament({ config } = {}) {
  const { tournamentRecord } = tournamentEngine.getTournament();
  if (tournamentRecord?.tournamentId === config.tournamentId) {
    routeTo(config);
  } else {
    context.ee.emit(LEAVE_TOURNAMENT, context.tournamentId);
    tmx2db.findTournament(config.tournamentId).then((tournamentRecord) => loadTournament({ tournamentRecord, config }));
  }
}

function renderTournament({ config }) {
  showContent(TOURNAMENT);
  tournamentHeader();
  highlightTab(config.selectedTab);
  routeTo(config);
}

export function routeTo(config) {
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

export function loadTournament({ tournamentRecord, config }) {
  if (!tournamentRecord) {
    const state = getLoginState();
    const providerId = state?.profile?.provider?.providerId;

    const notFound = () => {
      tmxToast({
        action: {
          text: 'Remove?',
          onClick: () => removeProviderTournament({ tournamentId: config.tournamentId, providerId }),
        },
        message: 'Tournament not found',
        onClose: () => {
          context.router.navigate('/tournaments');
        },
        intent: 'is-warning',
        pauseOnHover: true,
      });
    };

    if (providerId) {
      const showResult = (result) => {
        const tournamentRecord = result?.data?.tournamentRecord;
        if (tournamentRecord) {
          tournamentEngine.setState(tournamentRecord);
          renderTournament({ config });
        } else {
          notFound();
        }
      };
      getTournament({ tournamentId: config.tournamentId }).then(showResult, notFound);
    } else {
      console.log('no provider');
      notFound();
    }
  } else {
    tournamentEngine.setState(tournamentRecord);
    renderTournament({ config });
  }
}
