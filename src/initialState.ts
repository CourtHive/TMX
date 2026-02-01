/**
 * Application initialization and setup.
 * Sets up context, environment, event listeners, and routing.
 */
import { factoryConstants, globalState, tournamentEngine } from 'tods-competition-factory';
import { tournamentContent } from 'pages/tournament/container/tournamentContent';
import { initLoginToggle } from 'services/authentication/loginState';
import { initSettingsIcon } from 'components/modals/settingsModal';
import { courthiveComponentsVersion } from 'courthive-components';
import { loadSettings } from 'services/settings/settingsStorage';
import { EventEmitter } from './services/EventEmitter';
import { setWindow } from 'config/setWindow';
import { tmxNavigation } from 'navigation';
import { context } from 'services/context';
import { drawer } from 'components/drawer';
import { routeTMX } from 'router/router';
import { setDev } from 'services/setDev';
import { initConfig } from 'config/config';
import { version } from 'config/version';
import { env } from 'settings/env';

import { SPLASH, TMX_TOURNAMENTS } from 'constants/tmxConstants';

import dragMatch from 'assets/icons/dragmatch.png';

import 'vanillajs-datepicker/css/datepicker-bulma.css';
import '@event-calendar/core/index.css';
import 'timepicker-ui/main.css';
import 'styles/legacy/scoreboard.css';
import 'styles/legacy/ddScoring.css';

import 'bulma-checkradio/dist/css/bulma-checkradio.min.css';
import 'bulma-switch/dist/css/bulma-switch.min.css';
import 'animate.css/animate.min.css';
import 'quill/dist/quill.snow.css';
import 'pikaday/css/pikaday.css';

import 'tippy.js/themes/light-border.css';
import 'tippy.js/themes/light.css';
import 'tippy.js/dist/tippy.css';

import 'styles/tabulator.css';

import 'bulma/css/versions/bulma-no-dark-mode.min.css';

import 'styles/tournamentContainer.css';
import 'styles/tournamentSchedule.css';
import 'styles/overlay.css';
import 'styles/leaflet.css';
import 'styles/fa.min.css';
import 'styles/icons.css';
import 'styles/tmx.css';

export function setupTMX(): void {
  // Load settings from localStorage before initializing
  const savedSettings = loadSettings();
  if (savedSettings) {
    if (savedSettings.activeScale) {
      env.activeScale = savedSettings.activeScale;
    }
    if (savedSettings.scoringApproach) {
      env.scoringApproach = savedSettings.scoringApproach;
    }
    if (savedSettings.saveLocal !== undefined) {
      env.saveLocal = savedSettings.saveLocal;
    }
    if (savedSettings.pdfPrinting !== undefined) {
      env.pdfPrinting = savedSettings.pdfPrinting;
    }
    if (savedSettings.minCourtGridRows !== undefined) {
      env.schedule.minCourtGridRows = savedSettings.minCourtGridRows;
    }
  }

  setEnv();
  setWindow();
  setContext();
  tournamentContent();
  initLoginToggle('login');
  initLoginToggle('burger');
  initSettingsIcon('config');

  if (!(Array.prototype as any).toSorted) {
    (Array.prototype as any).toSorted = function (compareFn?: (a: any, b: any) => number) {
      return this.slice().sort(compareFn);
    };
  }

  context.drawer = drawer();

  initConfig().then(tmxReady, (err) => console.log({ err }));
}

function tmxReady(): void {
  console.log('%c TMX ready', 'color: lightgreen');
  setDev();
  setSubscriptions();

  const splashElement = document.getElementById(SPLASH);
  if (splashElement) {
    splashElement.onclick = () => context.router.navigate(`/${TMX_TOURNAMENTS}`);
  }
  routeTMX();
  tmxNavigation();
}

function setContext(): void {
  context.dragMatch = new Image();
  context.dragMatch.src = dragMatch;
  context.ee = new EventEmitter();
}

const RESIZE_LOOP = 'ResizeObserver loop limit exceeded';
const RESIZE_NOTIFICATIONS = 'ResizeObserver loop completed with undelivered notifications.';

function setEnv(): void {
  env.device = getDevice();
  const cfv = tournamentEngine.version();
  const chcv = courthiveComponentsVersion();
  console.log(`%cversion: ${version}`, 'color: lightblue');
  console.log(`%cfactory: ${cfv}`, 'color: lightblue');
  console.log(`%ccourthive-components: ${chcv}`, 'color: lightblue');

  eventListeners();
}

function setSubscriptions(): void {
  const topicConstants = factoryConstants.topicConstants;
  globalState.setSubscriptions({
    subscriptions: {
      [topicConstants.MODIFY_MATCHUP]: (data: any) => {
        const matchUpId = data.matchUp?.matchUpId;
        context.matchUpsToBroadcast.push(matchUpId);
        if (env.devNotes) console.log('MODIFY_MATCHUP', data);
      },
    },
  });
}

function eventListeners(): void {
  window.addEventListener('error', (e) => {
    if ([RESIZE_LOOP, RESIZE_NOTIFICATIONS].includes(e.message)) {
      const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
      const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
      if (resizeObserverErr) {
        resizeObserverErr.setAttribute('style', 'display: none');
      }
      if (resizeObserverErrDiv) {
        resizeObserverErrDiv.setAttribute('style', 'display: none');
      }
    }
  });
}

function getDevice(): any {
  const nav = getNavigator();
  return {
    isStandalone: nav && 'standalone' in nav && (nav as any).standalone,
    isIDevice: nav && /iphone|ipod|ipad/i.test(nav.userAgent),
    isIpad: nav && /iPad/i.test(nav.userAgent),
    isWindows: nav && /indows/i.test(nav.userAgent),
    isMobile: nav && /Mobi/.test(nav.userAgent),
  };
}

function getNavigator(): Navigator | undefined {
  try {
    return navigator || (window as any).navigator;
  } catch (err) {
    console.log(err);
    return undefined;
  }
}
