import { NONE, SPLASH, TMX_CONTENT, TMX_TOURNAMENTS, TOURNAMENTS_CALENDAR } from 'constants/tmxConstants';

let content;

function selectDisplay(which) {
  setState(TMX_CONTENT, which);
  setState(SPLASH, which);
  setState(TMX_TOURNAMENTS, which);
  setState(TOURNAMENTS_CALENDAR, which);

  const trnynav = document.getElementById('trnynav');
  const dnav = document.getElementById('dnav');
  if ([TMX_CONTENT, TMX_TOURNAMENTS].includes(which)) {
    trnynav.style.display = which === TMX_CONTENT ? '' : NONE;
    dnav.style.display = '';
  } else {
    dnav.style.display = NONE;
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
  const dnav = document.getElementById('dnav');
  dnav.style.display = NONE;
  content = SPLASH;
  selectDisplay(SPLASH);
};
export const showContent = (what) => {
  content = what;
  selectDisplay(TMX_CONTENT);
};
export const showTMXtournaments = () => {
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement) {
    tournamentElement.innerHTML = `<div class='tmx-title'>Tournaments</div>`;
  }
  content = TMX_TOURNAMENTS;
  selectDisplay(content);
};
export const showTMXcalendar = () => {
  content = TOURNAMENTS_CALENDAR;
  selectDisplay(content);
};
export const splashActive = () => isActive(SPLASH);
export const contentActive = () => isActive(TMX_CONTENT);
