import { enhancedContentFunction } from 'services/dom/toolTip/plugins';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';
import tippy from 'tippy.js';

import {
  BOTTOM,
  EVENTS_TAB,
  MATCHUPS_TAB,
  PARTICIPANTS,
  SCHEDULE_TAB,
  TOURNAMENT,
  TOURNAMENT_OVERVIEW,
  VENUES_TAB,
} from 'constants/tmxConstants';

const routeMap = {
  'o-route': TOURNAMENT_OVERVIEW,
  'p-route': PARTICIPANTS,
  'e-route': EVENTS_TAB,
  'm-route': MATCHUPS_TAB,
  's-route': SCHEDULE_TAB,
  'v-route': VENUES_TAB,
};

const tips = {
  'o-route': 'Overview',
  'p-route': 'Participants',
  'e-route': 'Events',
  'm-route': 'MatchUps',
  's-route': 'Schedule',
  'v-route': 'Venues',
};

export function tmxNavigation() {
  const html = `
  <div class="side-bar collapse">
    <ul class="features-list">
      <span class="features-item-text">Overview</span>
      <span class="features-item-text">Participants</span>
      <span class="features-item-text">Events</span>
      <span class="features-item-text">Matches</span>
      <span class="features-item-text">Schedule</span>
      <span class="features-item-text">Venues</span>
    </ul>
  </div>
`;

  const element = document.getElementById('navText');
  element.innerHTML = html;

  const ids = Object.keys(routeMap);

  const selectedTab = context.router?.current?.[0]?.data?.selectedTab;

  const tippyContent = (text) => {
    const sideBar = document.querySelector('.side-bar');
    return sideBar.classList.contains('collapse') ? text : '';
  };

  const tRoute = document.getElementById('o-route');

  tippy(tRoute, {
    dynContent: () => tippyContent(tips['o-route']),
    onShow: (options) => !!options.props.content,
    plugins: [enhancedContentFunction],
    placement: BOTTOM,
    arrow: false,
  });

  ids.forEach((id) => {
    const element = document.getElementById(id);
    tippy(element, {
      dynContent: () => tippyContent(tips[id]),
      onShow: (options) => !!options.props.content,
      plugins: [enhancedContentFunction],
      placement: BOTTOM,
      arrow: false,
    });

    if (selectedTab === routeMap[id] || (!selectedTab && routeMap[id] === PARTICIPANTS)) {
      element.style.color = 'blue';
    }

    element.onclick = () => {
      document.querySelectorAll('.nav-icon').forEach((i) => (i.style.color = ''));
      element.style.color = 'blue';

      const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
      const route = `/${TOURNAMENT}/${tournamentId}/${routeMap[id]}`;
      context.router.navigate(route);
    };
  });
}

export function highlightTab(selectedTab) {
  document.querySelectorAll('.nav-icon').forEach((i) => (i.style.color = ''));

  const ids = Object.keys(routeMap);
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (selectedTab === routeMap[id] || (!selectedTab && routeMap[id] === PARTICIPANTS)) {
      element.style.color = 'blue';
    }
  });
}
