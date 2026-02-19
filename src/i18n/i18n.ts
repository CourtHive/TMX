import i18next from 'i18next';
import en from './locales/en.json';

i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: { en: { translation: en } },
});

export const t = i18next.t.bind(i18next);
export default i18next;
