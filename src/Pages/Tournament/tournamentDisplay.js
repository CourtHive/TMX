import { renderParticipantTab } from 'Pages/Tournament/Tabs/participantTab/participantsTab';
import { removeProviderTournament } from 'services/storage/removeProviderTournament';
import { renderScheduleTab } from 'Pages/Tournament/Tabs/scheduleTab/scheduleTab';
import { renderMatchUpTab } from 'Pages/Tournament/Tabs/matchUpsTab/matchUpsTab';
import { renderVenueTab } from 'Pages/Tournament/Tabs/scheduleTab/venuesTab';
import { renderEventsTab } from 'Pages/Tournament/Tabs/eventsTab/eventsTab';
import { renderOverview } from './Tabs/overviewTab/renderOverview';
import { getLoginState } from 'services/authentication/loginState';
import { showContent } from 'services/transitions/screenSlaver';
import { tournamentEngine } from 'tods-competition-factory';
import { displayTab } from './Container/tournamentContent';
import { tmxToast } from 'services/notifications/tmxToast';
import { getTournament } from 'services/apis/servicesApi';
import { tournamentHeader } from './tournamentHeader';
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
  TOURNAMENT_OVERVIEW
} from 'constants/tmxConstants';

export function displayTournament({ config } = {}) {
  const { tournamentRecord } = tournamentEngine.getState();
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
  const { participantView, selectedTab = PARTICIPANTS, structureId, renderDraw, eventId, drawId } = config;
  if (displayTab(selectedTab)) {
    if (selectedTab === TOURNAMENT_OVERVIEW) renderOverview();
    if (selectedTab === PARTICIPANTS) renderParticipantTab({ participantView });
    if (selectedTab === EVENTS_TAB) renderEventsTab({ renderDraw, eventId, drawId, structureId });
    if (selectedTab === SCHEDULE_TAB) renderScheduleTab();
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
          onClick: () => removeProviderTournament({ tournamentId: config.tournamentId, providerId })
        },
        message: 'Tournament not found',
        onClose: () => {
          context.router.navigate('/tournaments');
        },
        intent: 'is-warning',
        pauseOnHover: true
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
      getTournament({ tournamentId: config.tournamentId, providerId }).then(showResult, notFound);
    } else {
      console.log('no provider');
      notFound();
    }
  } else {
    tournamentEngine.setState(tournamentRecord);
    renderTournament({ config });
  }
}
