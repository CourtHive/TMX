/**
 * Tournament navigation sidebar with tooltips.
 * Manages tab navigation and highlighting for tournament sections.
 * On mobile, renders a dropdown with translated page names instead of icons.
 */
import { enhancedContentFunction } from 'services/dom/toolTip/plugins';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';
import { env } from 'settings/env';
import { t } from 'i18n';
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
  SETTINGS_TAB,
} from 'constants/tmxConstants';

const ACCENT_BLUE = 'var(--tmx-accent-blue)';

const routeMap: Record<string, string> = {
  'o-route': TOURNAMENT_OVERVIEW,
  'p-route': PARTICIPANTS,
  'e-route': EVENTS_TAB,
  'm-route': MATCHUPS_TAB,
  's-route': SCHEDULE_TAB,
  'v-route': VENUES_TAB,
  'c-route': SETTINGS_TAB,
};

const tips: Record<string, string> = {
  'o-route': 'Overview',
  'p-route': 'Participants',
  'e-route': 'Events',
  'm-route': 'MatchUps',
  's-route': 'Schedule',
  'v-route': 'Venues',
  'c-route': 'Settings',
};

// i18n keys for each route
const i18nKeys: Record<string, string> = {
  'o-route': 'ovw',
  'p-route': 'prt',
  'e-route': 'evt',
  'm-route': 'mts',
  's-route': 'sch',
  'v-route': 'ven',
  'c-route': 'set',
};

function navigateToRoute(id: string): void {
  document.querySelectorAll('.nav-icon').forEach((i) => ((i as HTMLElement).style.color = ''));
  const element = document.getElementById(id);
  if (element) element.style.color = ACCENT_BLUE;

  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
  const route = `/${TOURNAMENT}/${tournamentId}/${routeMap[id]}`;
  context.router?.navigate(route);
}

function setupMobileNav(selectedTab: string | undefined): void {
  const toggle = document.getElementById('mobileNavToggle');
  const menu = document.getElementById('mobileNavMenu');
  if (!toggle || !menu) return;

  // Determine current route id
  const currentId =
    Object.keys(routeMap).find((id) => routeMap[id] === selectedTab) || 'o-route';

  // Set toggle label to translated current page name
  toggle.textContent = t(i18nKeys[currentId]);

  // Build dropdown items
  menu.innerHTML = '';
  const ids = Object.keys(routeMap);
  ids.forEach((id) => {
    const item = document.createElement('button');
    item.className = 'mobile-nav-item';
    item.textContent = t(i18nKeys[id]);
    if (id === currentId) item.classList.add('mobile-nav-item--active');

    item.onclick = () => {
      toggle.textContent = t(i18nKeys[id]);
      menu.classList.remove('mobile-nav-menu--open');
      toggle.setAttribute('aria-expanded', 'false');
      navigateToRoute(id);

      // Update active state
      menu.querySelectorAll('.mobile-nav-item').forEach((el) => el.classList.remove('mobile-nav-item--active'));
      item.classList.add('mobile-nav-item--active');
    };

    menu.appendChild(item);
  });

  // Toggle dropdown on click
  toggle.onclick = () => {
    const isOpen = menu.classList.toggle('mobile-nav-menu--open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  };

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav && !mobileNav.contains(e.target as Node)) {
      menu.classList.remove('mobile-nav-menu--open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

export function tmxNavigation(): void {
  const html = `
  <div class="side-bar collapse">
    <ul class="features-list">
      <span class="features-item-text">Overview</span>
      <span class="features-item-text">Participants</span>
      <span class="features-item-text">Events</span>
      <span class="features-item-text">Matches</span>
      <span class="features-item-text">Schedule</span>
      <span class="features-item-text">Venues</span>
      <span class="features-item-text">Settings</span>
    </ul>
  </div>
`;

  const element = document.getElementById('navText')!;
  element.innerHTML = html;

  const ids = Object.keys(routeMap);

  const selectedTab = context.router?.current?.[0]?.data?.selectedTab;

  const tippyContent = (text: string) => {
    const sideBar = document.querySelector('.side-bar');
    return sideBar?.classList.contains('collapse') ? text : '';
  };

  const tRoute = document.getElementById('o-route')!;

  (tippy as any)(tRoute, {
    dynContent: () => !env.device.isMobile && tippyContent(tips['o-route']),
    onShow: (options: any) => !!options.props.content,
    plugins: [enhancedContentFunction],
    placement: BOTTOM,
    arrow: false,
  });

  ids.forEach((id) => {
    const element = document.getElementById(id)!;
    (tippy as any)(element, {
      dynContent: () => !env.device.isMobile && tippyContent(tips[id]),
      onShow: (options: any) => !!options.props.content,
      plugins: [enhancedContentFunction],
      placement: BOTTOM,
      arrow: false,
    });

    if (selectedTab === routeMap[id] || (!selectedTab && routeMap[id] === TOURNAMENT_OVERVIEW)) {
      element.style.color = ACCENT_BLUE;
    }

    element.onclick = () => {
      navigateToRoute(id);

      // Sync mobile nav label
      const toggle = document.getElementById('mobileNavToggle');
      if (toggle) toggle.textContent = t(i18nKeys[id]);
      const menu = document.getElementById('mobileNavMenu');
      menu?.querySelectorAll('.mobile-nav-item').forEach((el, idx) => {
        el.classList.toggle('mobile-nav-item--active', Object.keys(routeMap)[idx] === id);
      });
    };
  });

  // Initialize mobile dropdown
  setupMobileNav(selectedTab);
}

export function highlightTab(selectedTab: string): void {
  document.querySelectorAll('.nav-icon').forEach((i) => ((i as HTMLElement).style.color = ''));

  const ids = Object.keys(routeMap);
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element && (selectedTab === routeMap[id] || (!selectedTab && routeMap[id] === TOURNAMENT_OVERVIEW))) {
      element.style.color = ACCENT_BLUE;

      // Sync mobile nav
      const toggle = document.getElementById('mobileNavToggle');
      if (toggle) toggle.textContent = t(i18nKeys[id]);
      const menu = document.getElementById('mobileNavMenu');
      menu?.querySelectorAll('.mobile-nav-item').forEach((el, idx) => {
        el.classList.toggle('mobile-nav-item--active', ids[idx] === id);
      });
    }
  });
}
