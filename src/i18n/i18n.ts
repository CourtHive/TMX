import i18next from 'i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';
import de from './locales/de.json';
import ar from './locales/ar.json';

i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    es: { translation: es },
    'pt-BR': { translation: ptBR },
    de: { translation: de },
    ar: { translation: ar },
  },
});

export const t = i18next.t.bind(i18next);
export default i18next;
