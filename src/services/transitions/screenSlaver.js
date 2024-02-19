// import { context } from 'services/context';

import { NAVBAR, NONE, SPLASH, TMX_CONTENT, TMX_TOURNAMENTS, TOURNAMENTS_CALENDAR } from 'constants/tmxConstants';

let content;

/*
function displayTournaments() {
  context.router.navigate(`/${TMX_TOURNAMENTS}`);
}
*/

function selectDisplay(which) {
  setState(TMX_CONTENT, which);
  setState(SPLASH, which);
  setState(TMX_TOURNAMENTS, which);
  setState(TOURNAMENTS_CALENDAR, which);

  const sideNav = document.getElementById('sideNav');
  if (which === TMX_CONTENT) {
    sideNav.style.display = '';
  } else {
    sideNav.style.display = NONE;
  }
}

function isActive(id) {
  const docnode = document.getElementById(id);
  return docnode && docnode.style.display === 'flex';
}

function setState(id, which) {
  const display = id === which;
  const docnode = document.getElementById(id);
  if (docnode) docnode.style.display = display ? 'flex' : 'none';
}

export const contentEquals = (what) => {
  return what ? what === content : content;
};
export const showSplash = () => {
  const navbar = document.getElementById(NAVBAR);
  navbar.style.display = NONE;
  content = SPLASH;
  selectDisplay(SPLASH);
};
export const showContent = (what) => {
  const navbar = document.getElementById(NAVBAR);
  navbar.style.display = '';
  content = what;
  selectDisplay(TMX_CONTENT);
};
export const showTMXtournaments = () => {
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement) {
    tournamentElement.innerHTML = `<div class='tmx-title'>Tournaments</div>`;
  }
  const navbar = document.getElementById(NAVBAR);
  navbar.style.display = '';
  content = TMX_TOURNAMENTS;
  selectDisplay(content);
};
export const showTMXcalendar = () => {
  content = TOURNAMENTS_CALENDAR;
  selectDisplay(content);
};
export const splashActive = () => isActive(SPLASH);
export const contentActive = () => isActive(TMX_CONTENT);
