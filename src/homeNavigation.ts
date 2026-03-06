/**
 * Home context navigation bar with tooltips.
 * Manages tab navigation and highlighting for non-tournament pages.
 * On mobile, renders a dropdown with translated page names instead of icons.
 */
import { enhancedContentFunction } from 'services/dom/toolTip/plugins';
import { context } from 'services/context';
import { env } from 'settings/env';
import { t } from 'i18n';
import tippy from 'tippy.js';

import { BOTTOM, TMX_TOURNAMENTS, TEMPLATES, POLICIES, SETTINGS } from 'constants/tmxConstants';

const ACCENT_BLUE = 'var(--tmx-accent-blue)';
const ACTIVE_CLASS = 'mobile-nav-item--active';
const MENU_OPEN_CLASS = 'mobile-nav-menu--open';
const ARIA_EXPANDED = 'aria-expanded';
const NAV_ITEM_SELECTOR = '.mobile-nav-item';

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

function navigateHomeRoute(id: string): void {
  document.querySelectorAll('.home-nav-icon').forEach((i) => ((i as HTMLElement).style.color = ''));
  const element = document.getElementById(id);
  if (element) element.style.color = ACCENT_BLUE;

  const route = `/${homeRouteMap[id]}`;
  context.router?.navigate(route);
}

function setupMobileHomeNav(currentRoute?: string): void {
  const toggle = document.getElementById('mobileHomeNavToggle');
  const menu = document.getElementById('mobileHomeNavMenu');
  if (!toggle || !menu) return;

  const currentId = Object.keys(homeRouteMap).find((id) => homeRouteMap[id] === currentRoute) || 'h-tournaments';

  toggle.textContent = t(homeI18nKeys[currentId]);

  menu.innerHTML = '';
  const ids = Object.keys(homeRouteMap);
  ids.forEach((id) => {
    const item = document.createElement('button');
    item.className = 'mobile-nav-item';
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
      dynContent: () => !env.device.isMobile && tippyContent(homeTips[id]),
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

      const toggle = document.getElementById('mobileHomeNavToggle');
      if (toggle) toggle.textContent = t(homeI18nKeys[id]);
      const menu = document.getElementById('mobileHomeNavMenu');
      menu?.querySelectorAll(NAV_ITEM_SELECTOR).forEach((el, idx) => {
        el.classList.toggle(ACTIVE_CLASS, ids[idx] === id);
      });
    };
  });

  setupMobileHomeNav(currentRoute);
}

export function highlightHomeTab(route: string): void {
  document.querySelectorAll('.home-nav-icon').forEach((i) => ((i as HTMLElement).style.color = ''));

  const ids = Object.keys(homeRouteMap);
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element && homeRouteMap[id] === route) {
      element.style.color = ACCENT_BLUE;

      const toggle = document.getElementById('mobileHomeNavToggle');
      if (toggle) toggle.textContent = t(homeI18nKeys[id]);
      const menu = document.getElementById('mobileHomeNavMenu');
      menu?.querySelectorAll(NAV_ITEM_SELECTOR).forEach((el, idx) => {
        el.classList.toggle(ACTIVE_CLASS, ids[idx] === id);
      });
    }
  });
}
