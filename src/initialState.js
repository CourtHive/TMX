import { factoryConstants, globalState, tournamentEngine } from 'tods-competition-factory';
import { tournamentContent } from 'pages/tournament/container/tournamentContent';
import { initLoginToggle } from 'services/authentication/loginState';
import { initSettingsIcon } from 'components/modals/settingsModal';
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
import 'styles/legacy/scoreboard.css';
import 'styles/legacy/ddScoring.css';

// import '@creativebulma/bulma-badge/dist/bulma-badge.min.css';
import 'bulma-checkradio/dist/css/bulma-checkradio.min.css';
import 'bulma-switch/dist/css/bulma-switch.min.css';
import 'awesomplete/awesomplete.css';
import 'animate.css/animate.min.css';
import 'quill/dist/quill.snow.css';
import 'pikaday/css/pikaday.css';
import 'bulma/css/bulma.css';

import 'tippy.js/themes/light-border.css';
import 'tippy.js/themes/light.css';
import 'tippy.js/dist/tippy.css';

import 'styles/tournamentContainer.css';
import 'styles/tournamentSchedule.css';
import 'styles/tabulator.css';
import 'styles/overlay.css';
import 'styles/sidebar.css';
import 'styles/leaflet.css';
import 'styles/fa.min.css';
import 'styles/icons.css';
import 'styles/tmx.css';

export function setupTMX() {
  setEnv();
  setWindow();
  setContext();
  tournamentContent();
  initLoginToggle('login');
  initLoginToggle('burger');
  initSettingsIcon('config');

  // add TMX Drawer
  context.drawer = drawer();

  // temporary while refactoring
  initConfig().then(tmxReady, (err) => console.log({ err }));
}

function tmxReady() {
  console.log('%c TMX ready', 'color: lightgreen');
  // TODO: uncomment upon release
  // if (window.location.host.startsWith('localhost:') || window.location.host.startsWith('https://courthive.github.io')) {
  // to re-enable also uncomment (notLocal) check in actions.js
  setDev();
  setSubscriptions();
  // }

  document.getElementById(SPLASH).onclick = () => context.router.navigate(`/${TMX_TOURNAMENTS}`);
  routeTMX();
  tmxNavigation();
}

function setContext() {
  context.dragMatch = new Image();
  context.dragMatch.src = dragMatch;
  context.ee = new EventEmitter();
}

const RESIZE_LOOP = 'ResizeObserver loop limit exceeded';
const RESIZE_NOTIFICATIONS = 'ResizeObserver loop completed with undelivered notifications.';

function setEnv() {
  env.device = getDevice();
  env.version_check = new Date().getTime();
  const cfv = tournamentEngine.version();
  console.log(`%cversion: ${version}`, 'color: lightblue');
  console.log(`%cfactory: ${cfv}`, 'color: lightblue');

  eventListeners();
}

function setSubscriptions() {
  const topicConstants = factoryConstants.topicConstants;
  globalState.setSubscriptions({
    subscriptions: {
      [topicConstants.MODIFY_MATCHUP]: (data) => {
        const matchUpId = data.matchUp?.matchUpId;
        context.matchUpsToBroadcast.push(matchUpId);
        env.devNotes && console.log('MODIFY_MATCHUP', data);
      },
    },
  });
}

function eventListeners() {
  /*
    see: https://webpack.js.org/configuration/dev-server/#overlay .
    webpack can be configured to suppress overlay on this error.
    add in 'devServer' =>  'client':

    overlay: {
      runtimeErrors: (error) => {
        if (error.message === "ResizeObserver loop limit exceeded") {
          return false;
        }
        return true;
      },
    },
  */
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

function getDevice() {
  let nav = getNavigator();
  return {
    isStandalone: nav && 'standalone' in nav && nav.standalone,
    isIDevice: nav && /iphone|ipod|ipad/i.test(nav.userAgent),
    isIpad: nav && /iPad/i.test(nav.userAgent),
    isWindows: nav && /indows/i.test(nav.userAgent),
    isMobile: nav && /Mobi/.test(nav.userAgent),
  };
}

function getNavigator() {
  try {
    return navigator || window.navigator;
  } catch (e) {
    return undefined;
  }
}
