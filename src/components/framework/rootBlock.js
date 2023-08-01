import { tournamentInfoBlock } from './infoiBlock';
import { navbarBlock } from './navbarBlock';
import { eventBlock } from './eventBlock';
import { TMXlogo } from './courtHiveLogo';

import {
  SPLASH,
  TOURNAMENTS_TABLE,
  TOURNAMENTS_CONTROL,
  TMX_CONTENT,
  TMX_TOURNAMENTS,
  TMX_DRAWER,
  TIMEPICKER,
  TIMEVALUE,
  NONE,
  TOURNAMENT_CONTAINER,
  TOURNAMENTS_CALENDAR
} from 'constants/tmxConstants';

export function rootBlock() {
  const root = document.createElement('div');

  const tp = document.createElement('div');
  tp.style.display = NONE;
  tp.id = TIMEPICKER;

  const tv = document.createElement('input');
  tv.className = 'timepicker-ui-input';
  tv.id = TIMEVALUE;
  tv.type = 'text';

  tp.appendChild(tv);
  root.appendChild(tp);

  const drawer = document.createElement('section');
  drawer.className = 'drawer drawer--left';
  drawer.setAttribute('data-drawer-target', '');
  drawer.id = TMX_DRAWER;
  drawer.innerHTML = `
      <div class="drawer__overlay" data-drawer-close tabIndex="-1"></div>
      <div class="drawer__wrapper">
        <div class="drawer__header">
          <div class="drawer__title">Title</div>
          <button
            class="drawer__close"
            style='display: none;'}
            data-drawer-close
            aria-label="Close Drawer"
          ></button>
        </div>
        <div class="drawer__content"></div>
        <div class="drawer__footer"></div>
      </div>
  `;

  root.appendChild(drawer);

  const main = document.createElement('div');
  main.className = 'main noselect';

  const splash = document.createElement('div');
  splash.className = 'flexrow flexcenter';
  splash.id = SPLASH;
  splash.style = 'margin-top: 2em; padding-top: 5em; display: none;';
  splash.appendChild(TMXlogo());
  main.appendChild(splash);

  const content = document.createElement('div');
  content.id = TMX_CONTENT;
  content.className = 'springboard flexrow flexcenter';
  content.style.display = NONE;

  const sidenav = document.createElement('div');
  sidenav.id = 'sideNav';
  sidenav.className = 'sideNav';
  content.appendChild(sidenav);

  const container = document.createElement('div');
  container.id = TOURNAMENT_CONTAINER;
  container.className = 'flexcol flexcenter tournament_container';
  container.appendChild(navbarBlock());
  container.appendChild(tournamentInfoBlock());
  container.appendChild(eventBlock());

  content.appendChild(container);
  main.appendChild(content);

  const tournaments = document.createElement('div');
  tournaments.className = 'flexcol flexgrow';
  tournaments.style.display = NONE;
  tournaments.id = TMX_TOURNAMENTS;

  const tControl = document.createElement('div');
  tControl.className = 'controlBar flexcol flexgrow flexcenter';
  tControl.id = TOURNAMENTS_CONTROL;
  tournaments.appendChild(tControl);

  const tTable = document.createElement('div');
  tTable.className = 'flexcol flexgrow flexcenter box';
  tTable.id = TOURNAMENTS_TABLE;
  tournaments.appendChild(tTable);

  main.appendChild(tournaments);

  const calendar = document.createElement('div');
  calendar.className = 'flexcol flexgrow';
  calendar.style = 'display: none; height: 90%; width: 100%;';
  calendar.id = TOURNAMENTS_CALENDAR;

  main.appendChild(calendar);
  root.appendChild(main);

  return root;
}
