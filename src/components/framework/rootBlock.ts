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
import { providerConfig } from 'config/providerConfig';

import {
  SPLASH,
  TOURNAMENTS_TABLE,
  TOURNAMENTS_CONTROL,
  TMX_CONTENT,
  TMX_TOURNAMENTS,
  TMX_TOPOLOGY,
  TMX_TEMPLATES,
  TMX_POLICIES,
  TMX_SETTINGS,
  TMX_DRAWER,
  TIMEPICKER,
  TIMEVALUE,
  NONE,
  TOURNAMENT_CONTAINER,
  TMX_ADMIN,
  TMX_SYSTEM,
} from 'constants/tmxConstants';

const flexColFlexGrow = 'flexcol flexgrow';

export function rootBlock(): HTMLElement {
  const root = document.getElementById('root')!;
  root.appendChild(newBlock());

  const branding = providerConfig.get().branding;
  let logo: SVGSVGElement | HTMLImageElement;
  if (branding?.splashLogoUrl) {
    logo = document.createElement('img') as HTMLImageElement;
    logo.src = branding.splashLogoUrl;
    logo.alt = branding.navbarLogoAlt ?? 'Logo';
    logo.style.maxWidth = '450px';
    logo.style.width = '100%';
  } else {
    logo = TMXlogo();
  }
  const splash = document.createElement('div');
  splash.className = 'flexrow flexcenter';
  splash.id = SPLASH;
  splash.appendChild(logo);
  root.appendChild(splash);

  const isRootUrl = !globalThis.location.hash || globalThis.location.hash === '#/' || globalThis.location.hash === '#';
  if (isRootUrl) {
    splash.style.cssText = 'margin-top: 2em; padding-top: 5em; display: flex;';
    const dnav = document.getElementById('dnav');
    if (dnav) dnav.style.display = NONE;
    splash.dataset.animating = 'true';

    if (branding?.splashLogoUrl) {
      // Static image splash — show briefly then navigate
      splash.style.cursor = 'pointer';
      const navigateAway = () => {
        delete splash.dataset.animating;
        splash.style.display = NONE;
        context.router?.navigate(`/${TMX_TOURNAMENTS}`);
      };
      splash.addEventListener('click', navigateAway);
      setTimeout(navigateAway, 2500);
    } else {
      // SVG fly-through animation
      const skipAnimation = animateLogoFlyThrough(logo as SVGSVGElement, {
        delay: 2000,
        duration: 2000,
        courtLineFade: 2000,
        onComplete: () => {
          delete splash.dataset.animating;
          splash.style.display = NONE;
          context.router?.navigate(`/${TMX_TOURNAMENTS}`);
        },
      });
      splash.style.cursor = 'pointer';
      splash.addEventListener('click', skipAnimation);
    }
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

  const templates = document.createElement('div');
  templates.className = flexColFlexGrow;
  templates.style.display = NONE;
  templates.id = TMX_TEMPLATES;
  main.appendChild(templates);

  const policies = document.createElement('div');
  policies.className = flexColFlexGrow;
  policies.style.display = NONE;
  policies.id = TMX_POLICIES;
  main.appendChild(policies);

  const settings = document.createElement('div');
  settings.className = flexColFlexGrow;
  settings.style.display = NONE;
  settings.id = TMX_SETTINGS;
  main.appendChild(settings);

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
      <i id='s2-route' class="nav-icon fa-solid fa-calendar-days"></i>
      <i id='v-route' class="nav-icon fa-solid fa-location-dot"></i>
      <span id='assistantIndicator' style="display:none; position:relative; cursor:pointer; align-items:center;" title="Ask TMX">
        <i class="nav-icon fa-solid fa-robot"></i>
      </span>
      <span id='chatIndicator' style="display:none; position:relative; cursor:pointer; align-items:center;" title="Tournament Chat">
        <i class="nav-icon fa-solid fa-comments"></i>
        <span id='chatBadge' style="display:none; position:absolute; top:0; right:-4px; width:10px; height:10px; background:#f59e0b; border-radius:50%; border:2px solid var(--chc-bg-primary, #fff);"></span>
      </span>
      <i id='syncIndicator' class="nav-icon fa-solid fa-rotate" style="display:none; cursor:pointer;" title="Data updated — click to refresh"></i>
      <i id='c-route' class="nav-icon fa-solid fa-sliders"></i>
      <div id="mobileNav" class="mobile-nav">
        <button id="mobileNavToggle" class="mobile-nav-toggle"></button>
        <div id="mobileNavMenu" class="mobile-nav-menu"></div>
      </div>
    </div>
    <div id='homenav' class="navbar-item" style="display: none; flex-direction: row;">
      <i id='h-tournaments' class="home-nav-icon fa-solid fa-list"></i>

      <i id='h-templates' class="home-nav-icon fa-solid fa-sitemap"></i>
      <i id='h-policies' class="home-nav-icon fa-solid fa-file-shield"></i>
      <i id='h-settings' class="home-nav-icon fa-solid fa-sliders"></i>
      <div id="mobileHomeNav" class="mobile-nav">
        <button id="mobileHomeNavToggle" class="mobile-nav-toggle"></button>
        <div id="mobileHomeNavMenu" class="mobile-nav-menu"></div>
      </div>
    </div>
    <div class="navbar-item" style="font-size: 1em; display: flex; align-items: center; gap: 2px;">
      <i id="themeToggle" style="cursor: pointer; padding: 0 .4em; opacity: 0.7;" class="fa-solid fa-moon" title="Toggle theme"></i>
      <i id="login" style="padding-left: .5em" class="fa-solid fa-circle-user"></i>
    </div>
  </div>
  <main id="navMain"></main>`;

  return block;
}
