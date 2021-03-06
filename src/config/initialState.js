//import { saveMyTournaments } from 'services/officiating/tournaments';
import { updateReady, popupsBlocked } from 'services/notifications/statusMessages';
import { getLoginState } from 'services/authentication/loginState';
import { parse as parseQueryString } from 'services/queryString';
import { initDB } from 'services/initialization/initDB';
import { resetDB } from 'services/storage/resetDB';
import { idiomSetup } from './idiom/idiomSetup';
import { context } from 'services/context';
import { tmxStore } from 'stores/tmxStore';
import { setDev } from 'config/setDev';
import { env } from 'config/defaults';

import { tournamentEngine } from 'tods-competition-factory';

import 'styles/main.css';

export function setupTMX() {
  setWindow();
  getLoginState();

  env.device = getDevice();
  env.version_check = new Date().getTime();

  context.queryString = parseQueryString();

  initOrientationChangeEvents();

  tmxStore.dispatch({
    type: 'set initial state',
    payload: { visibleTabs: env.visibleTabs, enabledComponents: env.enabledComponents }
  });

  initDB().then(tmxReady, initializationFailed);
}

function tmxReady() {
  setDev({ env });
  // saveMyTournaments();
  idiomSetup();

  const cfv = tournamentEngine.version();
  console.log(`%cversion: ${env.version}`, 'color: lightblue');
  console.log(`%cfactory: ${cfv}`, 'color: lightblue');

  console.log('%c TMX Ready', 'color: lightgreen');
}

function setWindow() {
  // disable context menu on the page
  document.oncontextmenu = () => false;
  window.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
    },
    false
  );
  window.packageEntry = { updateReady };
  window.onunhandledrejection = (event) => {
    event.preventDefault();
    const reason = event.reason;
    const message = reason && (reason.stack || reason);
    if (message && typeof message === 'string' && message.indexOf('blocked') > 0) {
      popupsBlocked();
    } else {
      console.log('Unhandled rejection:', reason && (reason.stack || reason));
      context.ee.emit('logError', reason);
    }
  };
}

function getDevice() {
  const nav = getNavigator();
  const device = {
    isStandalone: nav && 'standalone' in nav && nav.standalone,
    isIDevice: nav && /iphone|ipod|ipad/i.test(nav.userAgent),
    isIpad: nav && /iPad/i.test(nav.userAgent),
    isWindows: nav && /indows/i.test(nav.userAgent),
    isMobile: nav && /Mobi/.test(nav.userAgent)
  };
  return device;
}

function getNavigator() {
  try {
    return navigator || window.navigator;
  } catch (e) {
    return undefined;
  }
}

function initOrientationChangeEvents() {
  const setOrientation = () => {
    env.orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  };
  window.addEventListener(
    'orientationchange',
    function () {
      setOrientation();
    },
    false
  );
  window.addEventListener(
    'resize',
    function () {
      setOrientation();
    },
    false
  );
  setOrientation();
}

function initializationFailed(err) {
  if (err && err.name === 'OpenFailedError') {
    resetDB();
  } else {
    tmxStore.dispatch({
      type: 'toaster state',
      payload: { severity: 'error', message: 'Initialization Error' }
    });
  }
}
