/**
 * Home context navigation bar with tooltips.
 * Manages tab navigation and highlighting for non-tournament pages.
 * On mobile, renders a dropdown with translated page names instead of icons.
 */
import { getProviderRankingsUrl, providerHasRankings } from 'services/rankings/providerRankings';
import { isActiveProviderAdmin } from 'services/authentication/isProviderAdmin';
import { enhancedContentFunction } from 'services/dom/toolTip/plugins';
import { getLoginState } from 'services/authentication/loginState';
import { deviceConfig } from 'config/deviceConfig';
import { context } from 'services/context';
import tippy from 'tippy.js';
import { t } from 'i18n';

import { BOTTOM, TMX_TOURNAMENTS, TEMPLATES, POLICIES, SETTINGS } from 'constants/tmxConstants';

const ACCENT_BLUE = 'var(--tmx-accent-blue)';
const ACTIVE_CLASS = 'mobile-nav-item--active';
const MENU_OPEN_CLASS = 'mobile-nav-menu--open';
const ARIA_EXPANDED = 'aria-expanded';
const MOBILE_ITEM_CLASS = 'mobile-nav-item';
const NAV_ITEM_SELECTOR = `.${MOBILE_ITEM_CLASS}`;
const MOBILE_TOGGLE_ID = 'mobileHomeNavToggle';
const MOBILE_MENU_ID = 'mobileHomeNavMenu';

const homeRouteMap: Record<string, string> = {
  'h-tournaments': TMX_TOURNAMENTS,
  'h-templates': TEMPLATES,
  'h-policies': POLICIES,
  'h-settings': SETTINGS,
};

const homeTips: Record<string, string> = {
  'h-tournaments': 'Tournaments',
  'h-templates': 'Templates',
  'h-policies': 'Policies',
  'h-settings': 'Settings',
};

const homeI18nKeys: Record<string, string> = {
  'h-tournaments': 'tnz',
  'h-templates': 'tpl',
  'h-policies': 'pol',
  'h-settings': 'set',
};

// The rankings icon is NOT a homeRouteMap entry: it links out to the public
// rankings viewer in a new tab rather than routing inside TMX. It is shown only
// to provider admins (or super-admins impersonating) when the active provider
// actually has published rankings.
const RANKINGS_ICON = 'h-rankings';
const RANKINGS_MOBILE_ITEM = 'mobile-nav-rankings';

function activeProviderAbbr(): string | undefined {
  const provider = context.provider ?? getLoginState()?.provider;
  return provider?.organisationAbbreviation;
}

function sidebarTip(text: string): string {
  const sideBar = document.querySelector('.side-bar');
  return sideBar?.classList.contains('collapse') ? text : '';
}

function openRankings(abbreviation: string): void {
  globalThis.open(getProviderRankingsUrl(abbreviation), '_blank', 'noopener');
}

function removeRankingsMobileItem(): void {
  document.getElementById(RANKINGS_MOBILE_ITEM)?.remove();
}

function addRankingsMobileItem(abbreviation: string): void {
  const menu = document.getElementById(MOBILE_MENU_ID);
  if (!menu || document.getElementById(RANKINGS_MOBILE_ITEM)) return;

  const item = document.createElement('button');
  item.id = RANKINGS_MOBILE_ITEM;
  item.className = MOBILE_ITEM_CLASS;
  item.textContent = t('rnk');
  item.onclick = () => {
    menu.classList.remove(MENU_OPEN_CLASS);
    document.getElementById(MOBILE_TOGGLE_ID)?.setAttribute(ARIA_EXPANDED, 'false');
    openRankings(abbreviation);
  };
  menu.appendChild(item);
}

// Reveal the rankings icon (desktop + mobile) only when the active provider has
// published rankings. Starts hidden every render and reveals asynchronously once
// the existence probe resolves, so a provider switch never leaves a stale icon.
function setupRankingsNav(): void {
  const icon = document.getElementById(RANKINGS_ICON);
  if (!icon) return;

  icon.style.display = 'none';
  removeRankingsMobileItem();

  if (!isActiveProviderAdmin()) return;
  const abbreviation = activeProviderAbbr();
  if (!abbreviation) return;

  providerHasRankings(abbreviation).then((exists) => {
    if (!exists) return;
    // Guard against a provider switch while the probe was in flight.
    if (activeProviderAbbr()?.toUpperCase() !== abbreviation.toUpperCase()) return;

    icon.style.display = '';
    icon.onclick = () => openRankings(abbreviation);

    if ((icon as any)._tippy) (icon as any)._tippy.destroy();
    (tippy as any)(icon, {
      dynContent: () => !deviceConfig.get().isMobile && sidebarTip(t('rnk')),
      onShow: (options: any) => !!options.props.content,
      plugins: [enhancedContentFunction],
      placement: BOTTOM,
      arrow: false,
    });

    addRankingsMobileItem(abbreviation);
  });
}

// The console icon links out to the AMS provider console at `<origin>/console/`
// (same origin as TMX, shared JWT — the session carries over). Shown to provider
// admins / super-admins-impersonating; no existence probe, so it's synchronous.
const CONSOLE_ICON = 'h-console';
const CONSOLE_MOBILE_ITEM = 'mobile-nav-console';

function openConsole(): void {
  globalThis.open(`${globalThis.location.origin}/console/`, '_blank', 'noopener');
}

function removeConsoleMobileItem(): void {
  document.getElementById(CONSOLE_MOBILE_ITEM)?.remove();
}

function addConsoleMobileItem(): void {
  const menu = document.getElementById(MOBILE_MENU_ID);
  if (!menu || document.getElementById(CONSOLE_MOBILE_ITEM)) return;

  const item = document.createElement('button');
  item.id = CONSOLE_MOBILE_ITEM;
  item.className = MOBILE_ITEM_CLASS;
  item.textContent = t('cns');
  item.onclick = () => {
    menu.classList.remove(MENU_OPEN_CLASS);
    document.getElementById(MOBILE_TOGGLE_ID)?.setAttribute(ARIA_EXPANDED, 'false');
    openConsole();
  };
  menu.appendChild(item);
}

function setupConsoleNav(): void {
  const icon = document.getElementById(CONSOLE_ICON);
  if (!icon) return;

  removeConsoleMobileItem();

  if (!isActiveProviderAdmin()) {
    icon.style.display = 'none';
    return;
  }

  icon.style.display = '';
  icon.onclick = () => openConsole();

  if ((icon as any)._tippy) (icon as any)._tippy.destroy();
  (tippy as any)(icon, {
    dynContent: () => !deviceConfig.get().isMobile && sidebarTip(t('cns')),
    onShow: (options: any) => !!options.props.content,
    plugins: [enhancedContentFunction],
    placement: BOTTOM,
    arrow: false,
  });

  addConsoleMobileItem();
}

function navigateHomeRoute(id: string): void {
  document.querySelectorAll('.home-nav-icon').forEach((i) => ((i as HTMLElement).style.color = ''));
  const element = document.getElementById(id);
  if (element) element.style.color = ACCENT_BLUE;

  const route = `/${homeRouteMap[id]}`;
  context.router?.navigate(route);
}

function setupMobileHomeNav(currentRoute?: string): void {
  const toggle = document.getElementById(MOBILE_TOGGLE_ID);
  const menu = document.getElementById(MOBILE_MENU_ID);
  if (!toggle || !menu) return;

  const currentId = Object.keys(homeRouteMap).find((id) => homeRouteMap[id] === currentRoute) || 'h-tournaments';

  toggle.textContent = t(homeI18nKeys[currentId]);

  menu.innerHTML = '';
  const ids = Object.keys(homeRouteMap);
  ids.forEach((id) => {
    const item = document.createElement('button');
    item.className = MOBILE_ITEM_CLASS;
    item.textContent = t(homeI18nKeys[id]);
    if (id === currentId) item.classList.add(ACTIVE_CLASS);

    item.onclick = () => {
      toggle.textContent = t(homeI18nKeys[id]);
      menu.classList.remove(MENU_OPEN_CLASS);
      toggle.setAttribute(ARIA_EXPANDED, 'false');
      navigateHomeRoute(id);

      menu.querySelectorAll(NAV_ITEM_SELECTOR).forEach((el) => el.classList.remove(ACTIVE_CLASS));
      item.classList.add(ACTIVE_CLASS);
    };

    menu.appendChild(item);
  });

  toggle.onclick = () => {
    const isOpen = menu.classList.toggle(MENU_OPEN_CLASS);
    toggle.setAttribute(ARIA_EXPANDED, String(isOpen));
  };

  document.addEventListener('click', (e) => {
    const mobileNav = document.getElementById('mobileHomeNav');
    if (mobileNav && !mobileNav.contains(e.target as Node)) {
      menu.classList.remove(MENU_OPEN_CLASS);
      toggle.setAttribute(ARIA_EXPANDED, 'false');
    }
  });
}

export function homeNavigation(currentRoute?: string): void {
  const ids = Object.keys(homeRouteMap);

  const tippyContent = (text: string) => {
    const sideBar = document.querySelector('.side-bar');
    return sideBar?.classList.contains('collapse') ? text : '';
  };

  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;

    // Destroy existing tippy instance to avoid duplicates
    if ((element as any)._tippy) (element as any)._tippy.destroy();

    (tippy as any)(element, {
      dynContent: () => !deviceConfig.get().isMobile && tippyContent(homeTips[id]),
      onShow: (options: any) => !!options.props.content,
      plugins: [enhancedContentFunction],
      placement: BOTTOM,
      arrow: false,
    });

    // Highlight current page
    if (homeRouteMap[id] === currentRoute || (!currentRoute && homeRouteMap[id] === TMX_TOURNAMENTS)) {
      element.style.color = ACCENT_BLUE;
    } else {
      element.style.color = '';
    }

    element.onclick = () => {
      navigateHomeRoute(id);

      const toggle = document.getElementById(MOBILE_TOGGLE_ID);
      if (toggle) toggle.textContent = t(homeI18nKeys[id]);
      const menu = document.getElementById(MOBILE_MENU_ID);
      menu?.querySelectorAll(NAV_ITEM_SELECTOR).forEach((el, idx) => {
        el.classList.toggle(ACTIVE_CLASS, ids[idx] === id);
      });
    };
  });

  setupMobileHomeNav(currentRoute);
  setupRankingsNav();
  setupConsoleNav();
}

export function highlightHomeTab(route: string): void {
  document.querySelectorAll('.home-nav-icon').forEach((i) => ((i as HTMLElement).style.color = ''));

  const ids = Object.keys(homeRouteMap);
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element && homeRouteMap[id] === route) {
      element.style.color = ACCENT_BLUE;

      const toggle = document.getElementById(MOBILE_TOGGLE_ID);
      if (toggle) toggle.textContent = t(homeI18nKeys[id]);
      const menu = document.getElementById(MOBILE_MENU_ID);
      menu?.querySelectorAll(NAV_ITEM_SELECTOR).forEach((el, idx) => {
        el.classList.toggle(ACTIVE_CLASS, ids[idx] === id);
      });
    }
  });
}
