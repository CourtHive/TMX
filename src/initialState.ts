/**
 * Application initialization and setup.
 * Sets up context, environment, event listeners, and routing.
 */
import { factoryConstants, globalState, tournamentEngine } from 'tods-competition-factory';
import { tournamentContent } from 'pages/tournament/container/tournamentContent';
import { loadColumnVisibility } from 'components/tables/common/columnIsVisible';
import { initRemoteMutationHandler } from 'services/messaging/remoteMutations';
import { hydrateConfigFromStorage } from 'services/settings/settingsStorage';
import { initTheme, initThemeToggle } from 'services/theme/themeService';
import { initStalenessGuard } from 'services/staleness/stalenessGuard';
import { initLoginToggle } from 'services/authentication/loginState';
import { courthiveComponentsVersion } from 'courthive-components';
import { registerMenuHandler } from 'platform/menuHandler';
import { EventEmitter } from './services/EventEmitter';
import { deviceConfig } from 'config/deviceConfig';
import { debugConfig } from 'config/debugConfig';
import { setWindow } from 'config/setWindow';
import { tmxNavigation } from 'navigation';
import { context } from 'services/context';
import { drawer } from 'components/drawer';
import { routeTMX } from 'router/router';
import { setDev } from 'services/setDev';
import { initConfig } from 'config/config';
import { version } from 'config/version';
import { i18next } from 'i18n';

import dragMatch from 'assets/icons/dragmatch.png';

import 'courthive-components/dist/courthive-components.css';
import 'vanillajs-datepicker/css/datepicker.css';

// Register datepicker locales for i18n support
import { Datepicker } from 'vanillajs-datepicker';
import dpLocaleFr from 'vanillajs-datepicker/locales/fr';
import dpLocaleEs from 'vanillajs-datepicker/locales/es';
import dpLocaleDe from 'vanillajs-datepicker/locales/de';
import dpLocalePtBR from 'vanillajs-datepicker/locales/pt-BR';
import dpLocaleAr from 'vanillajs-datepicker/locales/ar';
import dpLocaleZhCN from 'vanillajs-datepicker/locales/zh-CN';
Object.assign(Datepicker.locales, dpLocaleFr, dpLocaleEs, dpLocaleDe, dpLocalePtBR, dpLocaleAr, dpLocaleZhCN);

import 'timepicker-ui/main.css';

import 'animate.css/animate.min.css';
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
  // Hydrate typed config modules from localStorage
  try {
    const savedSettings = hydrateConfigFromStorage();
    if (savedSettings?.language) {
      i18next.changeLanguage(savedSettings.language);
    }
  } catch (err) {
    console.error('Failed to hydrate config from storage:', err);
  }

  loadColumnVisibility();

  initTheme();

  setEnv();
  setWindow();
  setContext();
  tournamentContent();
  initLoginToggle('login');
  initLoginToggle('burger');
  initThemeToggle('themeToggle');
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
  registerMenuHandler();
  initRemoteMutationHandler();
  initStalenessGuard();
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
  deviceConfig.refresh();
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
        if (debugConfig.get().devNotes) console.log('MODIFY_MATCHUP', data);
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
