import { tournamentInfoBlock } from './infoiBlock';
import { initScrollNav } from './initScrollNav';
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
  TOURNAMENTS_CALENDAR,
} from 'constants/tmxConstants';

export function rootBlock() {
  const root = document.getElementById('root');
  root.appendChild(newBlock());

  const splash = document.createElement('div');
  splash.className = 'flexrow flexcenter';
  splash.id = SPLASH;
  splash.style = 'margin-top: 2em; padding-top: 5em; display: none;';
  splash.appendChild(TMXlogo());
  root.appendChild(splash);

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
          <div class="drawer__title"></div>
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

  const main = document.getElementById('navMain');

  const content = document.createElement('div');
  content.id = TMX_CONTENT;
  content.className = 'springboard flexrow flexcenter';
  content.style.display = NONE;

  const sidenav = document.createElement('div');
  sidenav.id = 'navText';
  sidenav.className = 'navText';
  sidenav.style.display = NONE;
  content.appendChild(sidenav);

  const container = document.createElement('div');
  container.id = TOURNAMENT_CONTAINER;
  container.className = 'flexcol flexcenter tournament_container';
  container.appendChild(tournamentInfoBlock());
  container.appendChild(eventBlock());

  content.appendChild(container);
  main.appendChild(content);

  const tournaments = document.createElement('div');
  tournaments.className = 'flexcol flexgrow';
  // tournaments.style.paddingTop = '3em';
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
  calendar.style.paddingTop = '3em';
  calendar.style.display = NONE;
  calendar.style.height = '90%';
  calendar.style.width = '100%';
  calendar.id = TOURNAMENTS_CALENDAR;

  main.appendChild(calendar);
  // root.appendChild(main);

  initScrollNav();

  return root;
}

function newBlock() {
  const block = document.createElement('div');
  block.innerHTML = `<div id='dnav'>
    <div class="navbar-item" style="display: flex; flex-wrap: nowrap">
      <div id="provider" style="display: flex; flex-direction: column">
        <div style="font-size: .6em">TMX</div>
      </div>
      <div style="padding-left: 1em" id="pageTitle"> </div>
    </div>
    <div id='trnynav' class="navbar-item" style="display: flex; flex-direction: row;">
      <i id='o-route' class="nav-icon fa-solid fa-trophy"></i>
      <i id='p-route' class="nav-icon fa-solid fa-user-group" style="color: blue"></i>
      <i id='e-route' class="nav-icon fa-solid fa-diagram-project"></i>
      <i id='m-route' class="nav-icon fa-solid fa-table-tennis-paddle-ball"></i>
      <i id='s-route' class="nav-icon fa-solid fa-clock"></i>
      <i id='v-route' class="nav-icon fa-solid fa-location-dot"></i>
    </div>
    <div class="navbar-item" style="font-size: 1em">
      <i id="config" class="fa-solid fa-sliders"></i>
      <i id="login" style="padding-left: .5em" class="fa-solid fa-circle-user"></i>
    </div>
  </div>
  <main id="navMain"></main>`;

  return block;
}
