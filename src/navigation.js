import { enhancedContentFunction } from 'services/dom/toolTip/plugins';
import { tournamentEngine } from 'tods-competition-factory';
import dragMatch from 'assets/icons/dragmatch.png';
import { context } from 'services/context';
import tippy from 'tippy.js';

import {
  EVENTS_TAB,
  MATCHUPS_TAB,
  PARTICIPANTS,
  RIGHT,
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
  const match = dragMatch;

  const html = `
  <div class="side-bar collapse">
    <ul class="features-list">
      <li id='o-route' class="features-item tournaments">
        <i class="nav-icon fa-solid fa-trophy" style="font-size: larger"> <span class="status"></span> </i>
          <span class="features-item-text">Overview</span>
      </li>
      <li id='p-route' class="features-item participants">
        <i class="nav-icon fa-solid fa-user-group" style="font-size: larger"></i>
        <span class="features-item-text">Participants</span>
      </li>
      <li id='e-route' class="features-item events">
        <i class="nav-icon fa-solid fa-diagram-project" style='font-size: larger'></i>
        <span class="features-item-text">Events</span>
      </li>
      <li id='m-route' class="features-item matches">
        <img src="${match}" class='nav-image' srcset=""/>
        <span class="features-item-text">Matches</span>
      </li>
      <li id='s-route' class="features-item schedule">
        <i class="nav-icon fa-solid fa-clock" style='font-size: larger'></i>
        <span class="features-item-text">Schedule</span>
      </li>
      <li id='v-route' class="features-item venues">
        <i class="nav-icon fa-solid fa-location-dot" style='font-size: larger'></i>
        <span class="features-item-text">Venues</span>
      </li>
    </ul>
  </div>
`;

  const element = document.getElementById('sideNav');
  element.innerHTML = html;

  const ids = Object.keys(routeMap);

  const selectedTab = context.router?.current?.[0]?.data?.selectedTab;

  const tippyContent = (text) => {
    const sideBar = document.querySelector('.side-bar');
    return sideBar.classList.contains('collapse') ? text : '';
  };

  const tRoute = document.getElementById('o-route');
  tRoute.onclick = () => {
    // toggleSideBar(false);
    console.log('tournament information');
  };

  tippy(tRoute, {
    dynContent: () => tippyContent(tips['o-route']),
    onShow: (options) => !!options.props.content,
    plugins: [enhancedContentFunction],
    placement: RIGHT,
    arrow: false,
  });

  ids.forEach((id) => {
    const element = document.getElementById(id);
    tippy(element, {
      dynContent: () => tippyContent(tips[id]),
      onShow: (options) => !!options.props.content,
      plugins: [enhancedContentFunction],
      placement: RIGHT,
      arrow: false,
    });

    if (selectedTab === routeMap[id] || (!selectedTab && routeMap[id] === PARTICIPANTS)) {
      element.classList.add('active');
    }

    element.onclick = () => {
      document.querySelectorAll('.features-item').forEach((i) => i.classList.remove('active'));
      element.classList.add('active');
      // toggleSideBar(false);

      const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
      const route = `/${TOURNAMENT}/${tournamentId}/${routeMap[id]}`;
      context.router.navigate(route);
    };
  });
}

export function highlightTab(selectedTab) {
  document.querySelectorAll('.features-item').forEach((i) => i.classList.remove('active'));

  const ids = Object.keys(routeMap);
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (selectedTab === routeMap[id] || (!selectedTab && routeMap[id] === PARTICIPANTS)) {
      element.classList.add('active');
    }
  });
}
