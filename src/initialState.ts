/**
 * Application initialization and setup.
 * Sets up context, environment, event listeners, and routing.
 */
import { tournamentContent } from 'pages/tournament/container/tournamentContent';
import { loadColumnVisibility } from 'components/tables/common/columnIsVisible';
import { initRemoteMutationHandler } from 'services/messaging/remoteMutations';
import { initProviderSwitcher } from 'services/provider/initProviderSwitcher';
import { hydrateConfigFromStorage } from 'services/settings/settingsStorage';
import { factoryConstants, globalState } from 'tods-competition-factory';
import { initTheme, initThemeToggle } from 'services/theme/themeService';
import { loadUserCompositions } from 'pages/templates/compositionBridge';
import { initStalenessGuard } from 'services/staleness/stalenessGuard';
import { initSessionGuard } from 'services/session/sessionGuard';
import { initTmxVersionCheck } from 'services/version/checkTmxVersion';
import { initLoginToggle } from 'services/authentication/loginState';
import { ensureLocaleCurrent, getCachedLocale, i18next } from 'i18n';
import { courthiveComponentsVersion } from 'courthive-components';
import { tournamentEngine } from 'services/factory/engine';
import { registerMenuHandler } from 'platform/menuHandler';
import { EventEmitter } from './services/EventEmitter';
import { initPdfFont } from 'services/pdf/pdfFont';
import { deviceConfig } from 'config/deviceConfig';
import { debugConfig } from 'config/debugConfig';
import { setWindow } from 'config/setWindow';
import { tmxNavigation } from 'navigation';
import { context } from 'services/context';
import { drawer } from 'components/drawer';
import { initConfig } from 'config/config';
import { routeTMX } from 'router/router';
import { setDev } from 'services/setDev';
import { version } from 'config/version';

import dragMatch from 'assets/icons/dragmatch.png';

import 'courthive-components/dist/courthive-components.css';
import 'vanillajs-datepicker/css/datepicker.css';

// Register datepicker locales for i18n support
import dpLocalePtBR from 'vanillajs-datepicker/locales/pt-BR';
import dpLocaleZhCN from 'vanillajs-datepicker/locales/zh-CN';
import dpLocaleFr from 'vanillajs-datepicker/locales/fr';
import dpLocaleEs from 'vanillajs-datepicker/locales/es';
import dpLocaleDe from 'vanillajs-datepicker/locales/de';
import dpLocaleAr from 'vanillajs-datepicker/locales/ar';
import { Datepicker } from 'vanillajs-datepicker';
Object.assign(Datepicker.locales, dpLocaleFr, dpLocaleEs, dpLocaleDe, dpLocalePtBR, dpLocaleAr, dpLocaleZhCN);

// `main.css` is structure-only — no `[data-theme=*]` selectors — so `ui.theme`
// values silently no-op. `index.css` bundles every theme (basic, dark, crane,
// blueprint, blueprint-dark, etc.) and is what the package's `style` field
// also points at.
import 'timepicker-ui/index.css';

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
import 'styles/components/roundProfileEditor.css';
import 'styles/theme.css';

import 'styles/tournamentContainer.css';
import 'styles/tournamentSchedule.css';
import 'styles/overlay.css';
import 'styles/leaflet.css';
import 'styles/fa.min.css';
import 'styles/icons.css';
import 'styles/tmx.css';

import type { TMXSettings } from 'services/settings/settingsStorage';
import { providerConfig } from 'config/providerConfig';

/**
 * Boot-time language resolution per Mentat/planning/I18N_DELIVERY.md:
 *   1. settings.language (user explicit, marked via languageExplicit)
 *   2. providerConfig.defaults.defaultLanguage (provider hint)
 *   3. navigator.language if it matches a known locale
 *   4. fallback 'en'
 *
 * If settings.language exists but languageExplicit is not true, treat it
 * as inherited and let provider default override.
 */
function resolveBootLanguage(savedSettings: TMXSettings | null): string | undefined {
  if (savedSettings?.language && savedSettings.languageExplicit) {
    return savedSettings.language;
  }
  const providerDefault = providerConfig.get().defaults?.defaultLanguage;
  if (providerDefault) return providerDefault;
  if (savedSettings?.language) return savedSettings.language;
  const navLang = typeof navigator === 'undefined' ? undefined : navigator.language;
  if (navLang) return navLang;
  return undefined;
}

export function setupTMX(): void {
  // Hydrate typed config modules from localStorage
  try {
    const savedSettings = hydrateConfigFromStorage();
    const resolved = resolveBootLanguage(savedSettings);
    if (resolved) {
      // Sync-load the cached locale before changeLanguage so the FIRST
      // render uses the right strings. Without this, the DOM is built
      // synchronously below with i18next holding only the bundled `en`
      // bundle, so all t() calls fall back to English — even though the
      // user picked (e.g.) `cs`. The background ensureLocaleCurrent call
      // further down upgrades the cache if a newer SHA is available.
      if (resolved !== 'en') {
        const cached = getCachedLocale(resolved);
        if (cached) {
          i18next.addResourceBundle(resolved, 'translation', cached.content, true, true);
        }
      }
      i18next.changeLanguage(resolved);
    }
  } catch (err) {
    console.error('Failed to hydrate config from storage:', err);
  }

  // Background upgrade: if CFS has a newer version of the active locale,
  // fetch and swap it in transparently. Bundled locales (above) already
  // rendered the UI; this is a non-blocking refresh.
  // See Mentat/planning/I18N_DELIVERY.md for the runtime-fetch architecture.
  queueMicrotask(() => {
    void ensureLocaleCurrent(i18next.language).catch((err) => {
      console.warn('i18n background upgrade failed:', err);
    });
  });

  loadColumnVisibility();

  initTheme();

  setEnv();
  setWindow();
  setContext();
  tournamentContent();
  initLoginToggle('login');
  initLoginToggle('burger');
  initThemeToggle('themeToggle');
  initProviderSwitcher();

  // Warm the PDF font catalog + apply the resolved font (user → provider →
  // helvetica) so all generated PDFs embed it. Re-applied after login in
  // loginState once the provider config (defaultPdfFont) is known.
  void initPdfFont();
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
  initSessionGuard();
  initTmxVersionCheck();
  // Populate the user-composition cache so resolveCompositionByName() can
  // find custom compositions on the first draw render. Fire-and-forget;
  // early renders fall through to builtin compositions until the load
  // completes.
  void loadUserCompositions().catch((err) =>
    console.warn('Failed to load user compositions:', err),
  );
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
