import i18next from 'i18next';
import en from './locales/en.json';

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

export const t = i18next.t.bind(i18next);
export default i18next;
