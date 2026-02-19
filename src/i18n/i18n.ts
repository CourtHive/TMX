import i18next from 'i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
});

export const t = i18next.t.bind(i18next);
export default i18next;
