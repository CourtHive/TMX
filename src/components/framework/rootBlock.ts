/**
 * Root application block structure.
 * Creates main navigation, content areas, tournament container, and drawer components.
 */
import { tournamentInfoBlock } from './infoiBlock';
import { initScrollNav } from './initScrollNav';
import { context } from 'services/context';
import { eventBlock } from './eventBlock';

// SVG/D3 version
import { animateLogoFlyThrough, TMXlogoSVG as TMXlogo } from './courtHiveLogoSVG';

import {
  SPLASH,
  TOURNAMENTS_TABLE,
  TOURNAMENTS_CONTROL,
  TMX_CONTENT,
  TMX_TOURNAMENTS,
  TMX_TOPOLOGY,
  TMX_DRAWER,
  TIMEPICKER,
  TIMEVALUE,
  NONE,
  TOURNAMENT_CONTAINER,
  TOURNAMENTS_CALENDAR,
  TMX_ADMIN,
  TMX_SYSTEM,
} from 'constants/tmxConstants';

const flexColFlexGrow = 'flexcol flexgrow';

export function rootBlock(): HTMLElement {
  const root = document.getElementById('root')!;
  root.appendChild(newBlock());

  const logo = TMXlogo();
  const splash = document.createElement('div');
  splash.className = 'flexrow flexcenter';
  splash.id = SPLASH;
  splash.appendChild(logo);
  root.appendChild(splash);

  const isRootUrl = !globalThis.location.hash || globalThis.location.hash === '#/' || globalThis.location.hash === '#';
  if (isRootUrl) {
    // Show splash immediately so the SVG has layout dimensions when the
    // fly-through animation fires.  Hide the nav bar during the splash.
    splash.style.cssText = 'margin-top: 2em; padding-top: 5em; display: flex;';
    const dnav = document.getElementById('dnav');
    if (dnav) dnav.style.display = NONE;
    splash.dataset.animating = 'true';

    const skipAnimation = animateLogoFlyThrough(logo, {
      delay: 2000, // 2s static display
      duration: 2000, // 2s fly-through
      courtLineFade: 2000, // 2s fade of court lines starting at fly-through start
      onComplete: () => {
        delete splash.dataset.animating;
        splash.style.display = NONE;
        context.router?.navigate(`/${TMX_TOURNAMENTS}`);
      },
    });

    // Click splash during static phase to skip animation
    splash.style.cursor = 'pointer';
    splash.addEventListener('click', skipAnimation);
  } else {
    splash.style.cssText = 'margin-top: 2em; padding-top: 5em; display: none;';
  }

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
  drawer.dataset.drawerTarget = '';
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

  const main = document.getElementById('navMain')!;

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
  tournaments.className = flexColFlexGrow;
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
  calendar.className = flexColFlexGrow;
  calendar.style.paddingTop = '3em';
  calendar.style.display = NONE;
  calendar.style.height = '90%';
  calendar.style.width = '100%';
  calendar.id = TOURNAMENTS_CALENDAR;

  main.appendChild(calendar);

  const topology = document.createElement('div');
  topology.className = flexColFlexGrow;
  topology.style.display = NONE;
  topology.id = TMX_TOPOLOGY;

  main.appendChild(topology);

  const admin = document.createElement('div');
  admin.className = flexColFlexGrow;
  admin.style.display = NONE;
  admin.id = TMX_ADMIN;

  main.appendChild(admin);

  const system = document.createElement('div');
  system.className = flexColFlexGrow;
  system.style.display = NONE;
  system.id = TMX_SYSTEM;

  main.appendChild(system);

  initScrollNav();

  return root;
}

function newBlock(): HTMLDivElement {
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
      <i id='b-route' class="nav-icon fa-solid fa-eye"></i>
      <i id='p-route' class="nav-icon fa-solid fa-user-group"></i>
      <i id='e-route' class="nav-icon fa-solid fa-diagram-project"></i>
      <i id='m-route' class="nav-icon fa-solid fa-table-tennis-paddle-ball"></i>
      <i id='s-route' class="nav-icon fa-solid fa-clock"></i>
      <i id='v-route' class="nav-icon fa-solid fa-location-dot"></i>
      <i id='c-route' class="nav-icon fa-solid fa-sliders"></i>
      <div id="mobileNav" class="mobile-nav">
        <button id="mobileNavToggle" class="mobile-nav-toggle"></button>
        <div id="mobileNavMenu" class="mobile-nav-menu"></div>
      </div>
    </div>
    <div class="navbar-item" style="font-size: 1em">
      <i id="login" style="padding-left: .5em" class="fa-solid fa-circle-user"></i>
    </div>
  </div>
  <main id="navMain"></main>`;

  return block;
}
