/**
 * Tournament navigation sidebar with tooltips.
 * Manages tab navigation and highlighting for tournament sections.
 * On mobile, renders a dropdown with translated page names instead of icons.
 */
import { openAssistantPanel, checkAssistantHealth } from 'components/panels/assistantPanel';
import { getUnreadCount, onChatUpdate } from 'services/chat/chatService';
import { clearSyncIndicator } from 'services/messaging/remoteMutations';
import { enhancedContentFunction } from 'services/dom/toolTip/plugins';
import { openChatModal } from 'components/modals/chatModal';
import { tournamentEngine } from 'services/factory/engine';
import { providerConfig } from 'config/providerConfig';
import { featureFlags } from 'config/featureFlags';
import { deviceConfig } from 'config/deviceConfig';
import { context } from 'services/context';
import tippy from 'tippy.js';
import { t } from 'i18n';

// constants
import { canManageRegistrations } from 'pages/tournament/tabs/registrationsTab/canManageRegistrations';
import { getLoginState } from 'services/authentication/loginState';
import {
  BOTTOM,
  EVENTS_TAB,
  MATCHUPS_TAB,
  PARTICIPANTS,
  PUBLISHING_TAB,
  REGISTRATIONS_TAB,
  REPORTS_TAB,
  SCHEDULE2_TAB,
  TOURNAMENT,
  TOURNAMENT_OVERVIEW,
  VENUES_TAB,
  SETTINGS_TAB,
} from 'constants/tmxConstants';

const ACCENT_BLUE = 'var(--tmx-accent-blue)';
const ACTIVE_CLASS = 'mobile-nav-item--active';
const MENU_OPEN_CLASS = 'mobile-nav-menu--open';
const ARIA_EXPANDED = 'aria-expanded';
const NAV_ITEM_SELECTOR = '.mobile-nav-item';

const routeMap: Record<string, string> = {
  'o-route': TOURNAMENT_OVERVIEW,
  'p-route': PARTICIPANTS,
  'e-route': EVENTS_TAB,
  'm-route': MATCHUPS_TAB,
  's2-route': SCHEDULE2_TAB,
  'v-route': VENUES_TAB,
  'r-route': REPORTS_TAB,
  'rg-route': REGISTRATIONS_TAB,
  'b-route': PUBLISHING_TAB,
  'c-route': SETTINGS_TAB,
};

const tips: Record<string, string> = {
  'o-route': 'Overview',
  'p-route': 'Participants',
  'e-route': 'Events',
  'm-route': 'MatchUps',
  's2-route': 'Schedule',
  'v-route': 'Venues',
  'r-route': 'Reports',
  'rg-route': 'Registrations',
  'b-route': 'Publishing',
  'c-route': 'Settings',
};

// i18n keys for each route
const i18nKeys: Record<string, string> = {
  'o-route': 'ovw',
  'p-route': 'prt',
  'e-route': 'evt',
  'm-route': 'mts',
  's2-route': 'sch2',
  'v-route': 'ven',
  'r-route': 'rpt',
  'rg-route': 'regs',
  'b-route': 'pub',
  'c-route': 'set',
};

// rg-route is conditionally visible: hidden unless the loaded tournament
// has a published registrationProfile AND the caller has provider-admin
// authority over the tournament's provider. See Phase 2-B.1.
const CONDITIONAL_ROUTE_IDS = new Set(['rg-route']);

function navigateToRoute(id: string): void {
  clearSyncIndicator();
  document.querySelectorAll('.nav-icon').forEach((i) => ((i as HTMLElement).style.color = ''));
  const element = document.getElementById(id);
  if (element) element.style.color = ACCENT_BLUE;

  const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
  const route = `/${TOURNAMENT}/${tournamentId}/${routeMap[id]}`;
  context.router?.navigate(route);
}

function setupMobileNav(selectedTab: string | undefined): void {
  const toggle = document.getElementById('mobileNavToggle');
  const menu = document.getElementById('mobileNavMenu');
  if (!toggle || !menu) return;

  // Determine current route id
  const currentId = Object.keys(routeMap).find((id) => routeMap[id] === selectedTab) || 'o-route';

  // Set toggle label to translated current page name
  toggle.textContent = t(i18nKeys[currentId]);

  // Build dropdown items — route-based nav items. Conditional routes
  // (e.g. `rg-route` for Registrations) only appear in the dropdown
  // when their desktop counterpart is currently visible.
  menu.innerHTML = '';
  const ids = Object.keys(routeMap).filter((id) => {
    if (!CONDITIONAL_ROUTE_IDS.has(id)) return true;
    const el = document.getElementById(id);
    return !!el && el.style.display !== 'none';
  });
  ids.forEach((id) => {
    const item = document.createElement('button');
    item.className = 'mobile-nav-item';
    item.textContent = t(i18nKeys[id]);
    if (id === currentId) item.classList.add(ACTIVE_CLASS);

    item.onclick = () => {
      toggle.textContent = t(i18nKeys[id]);
      menu.classList.remove(MENU_OPEN_CLASS);
      toggle.setAttribute(ARIA_EXPANDED, 'false');
      navigateToRoute(id);

      // Update active state
      menu.querySelectorAll(NAV_ITEM_SELECTOR).forEach((el) => el.classList.remove(ACTIVE_CLASS));
      item.classList.add(ACTIVE_CLASS);
    };

    menu.appendChild(item);
  });

  // Panel toggles — assistant and chat (non-route items)
  if (featureFlags.get().assistant) addMobilePanelItem(menu, toggle, 'Ask TMX', () => openAssistantPanel());
  // Chat is on by default; a provider may disable it via provider config. It
  // also needs an authenticated session (server interaction), so hide it for a
  // locally-loaded tournament with no login.
  if (providerConfig.isAllowed('canUseChat') && getLoginState())
    addMobilePanelItem(menu, toggle, 'Chat', () => openChatModal());

  // Toggle dropdown on click
  toggle.onclick = () => {
    const isOpen = menu.classList.toggle(MENU_OPEN_CLASS);
    toggle.setAttribute(ARIA_EXPANDED, String(isOpen));
  };

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav && !mobileNav.contains(e.target as Node)) {
      menu.classList.remove(MENU_OPEN_CLASS);
      toggle.setAttribute(ARIA_EXPANDED, 'false');
    }
  });
}

/**
 * Toggle the Registrations nav icon based on the currently loaded
 * tournament + caller. Re-evaluated whenever a tournament render
 * settles (via highlightTab below) so navigating between tournaments
 * shows/hides the icon as their published-registration state changes.
 */
export function applyRegistrationsTabVisibility(): void {
  const el = document.getElementById('rg-route');
  if (!el) return;
  const tournamentRecord = tournamentEngine.q.tournament();
  const loginState = getLoginState();
  const allowed = canManageRegistrations({ tournamentRecord, loginState });
  el.style.display = allowed ? '' : 'none';
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
    dynContent: () => !deviceConfig.get().isMobile && tippyContent(tips['o-route']),
    onShow: (options: any) => !!options.props.content,
    plugins: [enhancedContentFunction],
    placement: BOTTOM,
    arrow: false,
  });

  ids.forEach((id) => {
    const element = document.getElementById(id)!;
    (tippy as any)(element, {
      dynContent: () => !deviceConfig.get().isMobile && tippyContent(tips[id]),
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
      menu?.querySelectorAll(NAV_ITEM_SELECTOR).forEach((el, idx) => {
        el.classList.toggle(ACTIVE_CLASS, Object.keys(routeMap)[idx] === id);
      });
    };
  });

  // Initialize mobile dropdown
  setupMobileNav(selectedTab);

  // Chat icon — show/hide based on feature flag and unread count
  setupChatIndicator();

  // Ask TMX assistant button (behind beta flag)
  if (featureFlags.get().assistant) setupAssistantIndicator();
}

function addMobilePanelItem(
  menu: HTMLElement,
  toggle: HTMLElement,
  label: string,
  action: () => void,
  visibilityId?: string,
): void {
  // Skip if the corresponding desktop indicator is hidden
  if (visibilityId) {
    const indicator = document.getElementById(visibilityId);
    if (indicator && indicator.style.display === 'none') return;
  }

  const divider = menu.querySelector('.mobile-nav-divider');
  if (!divider && menu.children.length > 0) {
    const hr = document.createElement('div');
    hr.className = 'mobile-nav-divider';
    hr.style.cssText = 'border-top: 1px solid var(--chc-border-primary, #ddd); margin: 4px 0;';
    menu.appendChild(hr);
  }

  const item = document.createElement('button');
  item.className = 'mobile-nav-item';
  item.textContent = label;
  item.onclick = () => {
    menu.classList.remove(MENU_OPEN_CLASS);
    toggle.setAttribute(ARIA_EXPANDED, 'false');
    action();
  };
  menu.appendChild(item);
}

export function setupChatIndicator(): void {
  const chatEl = document.getElementById('chatIndicator');
  const badgeEl = document.getElementById('chatBadge');
  if (!chatEl) return;

  // Chat is on by default but a provider may disable it via provider config.
  // It also requires an authenticated session — chat is a server interaction,
  // so a locally-loaded tournament with no login has nothing to talk to.
  if (!providerConfig.isAllowed('canUseChat') || !getLoginState()) {
    chatEl.style.display = 'none';
    return;
  }

  // The indicator lives in the tournament nav so its container controls
  // context visibility.
  chatEl.style.display = 'inline-flex';

  const updateVisibility = () => {
    const unread = getUnreadCount();
    if (badgeEl) badgeEl.style.display = unread > 0 ? 'block' : 'none';
  };

  chatEl.onclick = (e) => {
    e.stopPropagation();
    openChatModal();
  };
  onChatUpdate(updateVisibility);
  updateVisibility();
}

function setupAssistantIndicator(): void {
  const ids = ['assistantIndicator', 'assistantIndicatorHome'];
  const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
  if (elements.length === 0) return;

  for (const el of elements) {
    el.onclick = (e) => {
      e.stopPropagation();
      openAssistantPanel();
    };
  }

  // One health check drives visibility/opacity for both icons.
  checkAssistantHealth().then((healthy) => {
    for (const el of elements) {
      el.style.display = 'inline-flex';
      el.style.opacity = healthy ? '1' : '0.35';
      el.title = healthy ? 'Ask TMX' : 'Ask TMX (unavailable)';
    }
  });
}

export function highlightTab(selectedTab: string): void {
  // Re-evaluate conditional icons on every tab-render — a tournament's
  // registrationProfile changes over its lifecycle (publish → close)
  // and a director's role at a provider can change between renders.
  applyRegistrationsTabVisibility();

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
      menu?.querySelectorAll(NAV_ITEM_SELECTOR).forEach((el, idx) => {
        el.classList.toggle(ACTIVE_CLASS, ids[idx] === id);
      });
    }
  });
}
