/**
 * Screen state management for main content areas.
 * Controls visibility of splash, content, tournaments, and calendar views.
 */
import { NONE, SPLASH, TMX_CONTENT, TMX_TOURNAMENTS, TMX_TOPOLOGY, TOURNAMENTS_CALENDAR, TMX_ADMIN, TMX_SYSTEM } from 'constants/tmxConstants';

let content: string | undefined;

function selectDisplay(which: string): void {
  setState(TMX_CONTENT, which);
  setState(SPLASH, which);
  setState(TMX_TOURNAMENTS, which);
  setState(TMX_TOPOLOGY, which);
  setState(TOURNAMENTS_CALENDAR, which);
  setState(TMX_ADMIN, which);
  setState(TMX_SYSTEM, which);

  const trnynav = document.getElementById('trnynav');
  const dnav = document.getElementById('dnav');
  if ([TMX_CONTENT, TMX_TOURNAMENTS, TMX_TOPOLOGY, TMX_ADMIN, TMX_SYSTEM].includes(which)) {
    if (trnynav) trnynav.style.display = (which === TMX_CONTENT || which === TMX_TOPOLOGY) ? '' : NONE;
    if (dnav) dnav.style.display = '';
  } else {
    if (dnav) dnav.style.display = NONE;
  }
}

function isActive(id: string): boolean {
  const docnode = document.getElementById(id);
  return !!(docnode && docnode.style.display === 'flex');
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
export const showTMXcalendar = (): void => {
  content = TOURNAMENTS_CALENDAR;
  selectDisplay(content);
};
export const showTopology = (): void => {
  content = TMX_TOPOLOGY;
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
