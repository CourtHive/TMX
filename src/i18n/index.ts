export {
  ensureLocaleCurrent,
  getAvailableLocales,
  getCachedLocale,
  fetchManifest,
  fetchLocale,
} from './runtime-loader';
export { t, translate, default as i18next } from './i18n';
export type { Manifest, LocaleManifestEntry } from './runtime-loader';
export type { Translate } from './i18n';
