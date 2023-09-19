import { updateReady, popupsBlocked } from 'services/notifications/statusMessages';
import { tournamentContent } from 'Pages/Tournament/Container/tournamentContent';
import { tournamentEngine } from 'tods-competition-factory';
import { EventEmitter } from './services/EventEmitter';
import { tmxNavigation } from 'navigation';
import { context } from 'services/context';
import { drawer } from 'components/drawer';
import { routeTMX } from 'Router/router';
import { setDev } from 'services/setDev';
import { initConfig } from 'config/config';
import { version } from 'config/version';
import { isDev } from 'functions/isDev';
import { env } from 'settings/env';

import dragMatch from 'assets/icons/dragmatch.png';

import 'vanillajs-datepicker/css/datepicker-bulma.css';
import '@event-calendar/core/index.css';
import 'styles/legacy/scoreboard.css';
import 'styles/legacy/ddScoring.css';

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
import 'styles/tmx.css';

export function setupTMX() {
  setEnv();
  setWindow();
  setContext();
  tournamentContent();

  // add TMX Drawer
  context.drawer = drawer();

  // temporary while refactoring
  initConfig().then(tmxReady, (err) => console.log({ err }));
}

function tmxReady() {
  console.log('%c TMX ready', 'color: lightgreen');
  // TODO: uncomment upon release
  // if (window.location.host.startsWith('localhost:') || window.location.host.startsWith('https://courthive.github.io')) {
  setDev();
  // }

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
function setWindow() {
  // to disable context menu on the page
  document.oncontextmenu = () => false;
  window.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
    },
    false
  );
  window.packageEntry = { updateReady };
  /*
  window.onerror = (msg, url, lineNo, columnNo, error) => {
    console.log({ msg, error });
    if (!msg.includes('ResizeObserver')) {
      const errorMessage = isObject(msg) ? JSON.stringify(msg) : msg;
      const payload = { error, stack: { lineNo, columnNo, error: errorMessage } };
      context.ee.emit('emitTmx', { data: { action: CLIENT_ERROR, payload } });

      const message = {
        notice: `Error Detected: Development has been notified!`,
        title: 'warn'
      };
      context.ee.emit('addMessage', message);
    }
  };
  */
  window.onunhandledrejection = (event) => {
    if (isDev()) return;

    event.preventDefault();
    let reason = event.reason;
    let message = reason && (reason.stack || reason);
    if (message && message.indexOf('blocked') > 0) {
      popupsBlocked();
    } else {
      console.warn('Unhandled rejection:', reason && (reason.stack || reason));
      context.ee.emit('logError', reason);
    }
  };
}

function setEnv() {
  env.device = getDevice();
  env.version_check = new Date().getTime();
  const cfv = tournamentEngine.version();
  console.log(`%cversion: ${version}`, 'color: lightblue');
  console.log(`%cfactory: ${cfv}`, 'color: lightblue');

  eventListeners();
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
    isMobile: nav && /Mobi/.test(nav.userAgent)
  };
}

function getNavigator() {
  try {
    return navigator || window.navigator;
  } catch (e) {
    return undefined;
  }
}
