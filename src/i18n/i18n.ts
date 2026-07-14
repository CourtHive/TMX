import en from './locales/en.json';
import i18next from 'i18next';

// English is the only locale bundled with the build — it gives users an
// instant first paint without a network round-trip. All other locales are
// fetched at runtime from CFS via `ensureLocaleCurrent()` (see
// runtime-loader.ts and Mentat/planning/I18N_DELIVERY.md Phase 7).
i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: en },
  },
});

// Reflect the active locale's writing direction (and language) on the document
// root so RTL locales — currently Arabic — lay out right-to-left and assistive
// tech announces the correct language. `i18next.dir(lng)` resolves 'ltr'|'rtl'
// from i18next's built-in RTL language list, so no manifest round-trip is
// needed. Wired once here on the `languageChanged` event so BOTH boot-time
// selection (initialState.ts) and the language picker (selectIdiom.ts) are
// covered by a single hook. Full RTL layout QA (CSS logical properties) is a
// separate follow-up; this sets the direction the layout keys off.
function applyDocumentDirection(lng: string): void {
  if (typeof document === 'undefined') return; // node/test contexts have no DOM
  const root = document.documentElement;
  root.dir = i18next.dir(lng);
  root.lang = lng;
}

applyDocumentDirection(i18next.language ?? 'en');
i18next.on('languageChanged', applyDocumentDirection);

export const t = i18next.t.bind(i18next);
export default i18next;
