/**
 * Screen state management for main content areas.
 * Controls visibility of splash, content, tournaments, calendar, templates, policies views.
 * Manages switching between home nav bar and tournament nav bar.
 */
import {
  NONE,
  SPLASH,
  TMX_CONTENT,
  TMX_TOURNAMENTS,
  TMX_TOPOLOGY,
  TMX_TEMPLATES,
  TMX_POLICIES,
  TMX_SETTINGS,
  TMX_ADMIN,
  TMX_SYSTEM,
} from 'constants/tmxConstants';

let content: string | undefined;

const HOME_CONTEXT_PAGES = [TMX_TOURNAMENTS, TMX_TEMPLATES, TMX_POLICIES, TMX_SETTINGS];
const TOURNAMENT_CONTEXT_PAGES = [TMX_CONTENT, TMX_TOPOLOGY];

function selectDisplay(which: string): void {
  setState(TMX_CONTENT, which);
  setState(SPLASH, which);
  setState(TMX_TOURNAMENTS, which);
  setState(TMX_TOPOLOGY, which);
  setState(TMX_ADMIN, which);
  setState(TMX_SYSTEM, which);
  setState(TMX_TEMPLATES, which);
  setState(TMX_POLICIES, which);
  setState(TMX_SETTINGS, which);

  const trnynav = document.getElementById('trnynav');
  const homenav = document.getElementById('homenav');
  const dnav = document.getElementById('dnav');

  const allManagedPages = [...HOME_CONTEXT_PAGES, ...TOURNAMENT_CONTEXT_PAGES, TMX_ADMIN, TMX_SYSTEM];
  if (allManagedPages.includes(which)) {
    if (dnav) dnav.style.display = '';

    if (TOURNAMENT_CONTEXT_PAGES.includes(which)) {
      if (trnynav) trnynav.style.display = '';
      if (homenav) homenav.style.display = NONE;
    } else if (HOME_CONTEXT_PAGES.includes(which)) {
      if (trnynav) trnynav.style.display = NONE;
      if (homenav) homenav.style.display = '';
    } else {
      // Admin/System: hide both nav bars
      if (trnynav) trnynav.style.display = NONE;
      if (homenav) homenav.style.display = NONE;
    }
  } else if (dnav) {
    // Splash or unknown: hide entire dnav
    dnav.style.display = NONE;
  }
}

function isActive(id: string): boolean {
  const docnode = document.getElementById(id);
  return docnode?.style.display !== 'flex';
}

function setState(id: string, which: string): void {
  const display = id === which;
  const docnode = document.getElementById(id);
  if (docnode) docnode.style.display = display ? 'flex' : 'none';
}

export const contentEquals = (what?: string): boolean => {
  return what ? what === content : !!content;
};
export const showSplash = (): void => {
  const dnav = document.getElementById('dnav');
  if (dnav) dnav.style.display = NONE;
  content = SPLASH;
  selectDisplay(SPLASH);
};
export const showContent = (what: string): void => {
  content = what;
  selectDisplay(TMX_CONTENT);
};
export const showTMXtournaments = (): void => {
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement) {
    tournamentElement.innerHTML = `<div class='tmx-title'>Tournaments</div>`;
  }
  content = TMX_TOURNAMENTS;
  selectDisplay(content);
};
export const showTopology = (): void => {
  content = TMX_TOPOLOGY;
  selectDisplay(content);
};
export const showTMXtemplates = (): void => {
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement) {
    tournamentElement.innerHTML = `<div class='tmx-title'>Templates</div>`;
  }
  content = TMX_TEMPLATES;
  selectDisplay(content);
};
export const showTMXpolicies = (): void => {
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement) {
    tournamentElement.innerHTML = `<div class='tmx-title'>Policies</div>`;
  }
  content = TMX_POLICIES;
  selectDisplay(content);
};
export const showTMXsettings = (): void => {
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement) {
    tournamentElement.innerHTML = `<div class='tmx-title'>Settings</div>`;
  }
  content = TMX_SETTINGS;
  selectDisplay(content);
};
export const showTMXadmin = (): void => {
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement) {
    tournamentElement.innerHTML = `<div class='tmx-title'>Admin</div>`;
  }
  content = TMX_ADMIN;
  selectDisplay(content);
};
export const showTMXsystem = (): void => {
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement) {
    tournamentElement.innerHTML = `<div class='tmx-title'>System</div>`;
  }
  content = TMX_SYSTEM;
  selectDisplay(content);
};
export const splashActive = (): boolean => isActive(SPLASH);
export const contentActive = (): boolean => isActive(TMX_CONTENT);
