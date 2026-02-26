/**
 * Application initialization and setup.
 * Sets up context, environment, event listeners, and routing.
 */
import { factoryConstants, globalState, tournamentEngine } from 'tods-competition-factory';
import { tournamentContent } from 'pages/tournament/container/tournamentContent';
import { initLoginToggle } from 'services/authentication/loginState';

import { courthiveComponentsVersion } from 'courthive-components';
import { loadSettings } from 'services/settings/settingsStorage';
import { i18next } from 'i18n';
import { EventEmitter } from './services/EventEmitter';
import { setWindow } from 'config/setWindow';
import { tmxNavigation } from 'navigation';
import { context } from 'services/context';
import { drawer } from 'components/drawer';
import { routeTMX } from 'router/router';
import { setDev } from 'services/setDev';
import { initTheme } from 'services/theme/themeService';
import { initConfig } from 'config/config';
import { version } from 'config/version';
import { env } from 'settings/env';

import dragMatch from 'assets/icons/dragmatch.png';

import 'courthive-components/dist/courthive-components.css';
import 'vanillajs-datepicker/css/datepicker.css';
import '@event-calendar/core/index.css';
import 'timepicker-ui/main.css';

import 'animate.css/animate.min.css';
import 'quill/dist/quill.snow.css';
import 'pikaday/css/pikaday.css';

import 'tippy.js/themes/light-border.css';
import 'tippy.js/themes/light.css';
import 'tippy.js/dist/tippy.css';

import 'styles/tabulator.css';

import 'styles/components/buttons.css';
import 'styles/components/tags.css';
import 'styles/components/forms.css';
import 'styles/components/layout.css';
import 'styles/theme.css';

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
    if (savedSettings.language) {
      i18next.changeLanguage(savedSettings.language);
    }
  }

  initTheme();

  setEnv();
  setWindow();
  setContext();
  tournamentContent();
  initLoginToggle('login');
  initLoginToggle('burger');
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
  routeTMX();
  tmxNavigation();
}

function setContext(): void {
  context.dragMatch = new Image();
  context.dragMatch.src = dragMatch;

  // Create inverted (light) version for dark mode
  context.dragMatch.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = context.dragMatch.width;
    canvas.height = context.dragMatch.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.filter = 'invert(1)';
      ctx.drawImage(context.dragMatch, 0, 0);
      context.dragMatchLight = new Image();
      context.dragMatchLight.src = canvas.toDataURL();
    }
  };

  context.ee = new EventEmitter();
}

const RESIZE_LOOP = 'ResizeObserver loop limit exceeded';
const RESIZE_NOTIFICATIONS = 'ResizeObserver loop completed with undelivered notifications.';

function setEnv(): void {
  env.device = getDevice();
  const cfv = tournamentEngine.version();
  const chcv = courthiveComponentsVersion();
  const logStyle = 'color: lightblue';
  console.log(`%cversion: ${version}`, logStyle);
  console.log(`%cfactory: ${cfv}`, logStyle);
  console.log(`%ccourthive-components: ${chcv}`, logStyle);

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
  globalThis.addEventListener('error', (e) => {
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
    return navigator || (globalThis as any).navigator;
  } catch (err) {
    console.log(err);
    return undefined;
  }
}
