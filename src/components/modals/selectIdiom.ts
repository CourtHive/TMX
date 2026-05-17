/**
 * Select language/locale idiom modal.
 * Allows country selection with type-ahead and flag display for language switching.
 *
 * Sources available locales from the CFS manifest when reachable; falls back
 * to whatever's bundled in i18next. See Mentat/planning/I18N_DELIVERY.md.
 */
import { ensureLocaleCurrent, fetchManifest, i18next, t } from 'i18n';
import { renderForm } from 'courthive-components';
import { fixtures } from 'tods-competition-factory';
import { openModal } from './baseModal/baseModal';
import { persistConfigToStorage } from 'services/settings/settingsStorage';
import { preferencesConfig } from 'config/preferencesConfig';

// IOC country code to BCP47 language tag mapping
const iocToLang: Record<string, string> = {
  GBR: 'en',
  USA: 'en',
  AUS: 'en',
  FRA: 'fr',
  ESP: 'es',
  DEU: 'de',
  ITA: 'it',
  BRA: 'pt',
  POR: 'pt',
  NLD: 'nl',
  RUS: 'ru',
  JPN: 'ja',
  CHN: 'zh-CN',
  KOR: 'ko',
  SWE: 'sv',
  NOR: 'no',
  DEN: 'da',
  FIN: 'fi',
  POL: 'pl',
  CZE: 'cs',
  HUN: 'hu',
  ROU: 'ro',
  HRV: 'hr',
  SRB: 'sr',
  GRE: 'el',
  TUR: 'tr',
  IND: 'hi',
  ARG: 'es',
  MEX: 'es',
  COL: 'es',
  CAN: 'en',
};

export async function selectIdiom(): Promise<void> {
  // Source available locales from CFS manifest; fall back to bundled set.
  // Force-refresh — the modal is user-initiated and low-frequency, and the
  // user expects to see whatever locales are currently available, not
  // whatever was cached up to 5 minutes ago. Without `{ force: true }`,
  // newly-added locales (e.g. cs/hr) wouldn't appear until the cache
  // naturally expired.
  const manifest = await fetchManifest({ force: true });
  const bundledLanguages = Object.keys(i18next.options?.resources || {});
  const manifestLanguages = manifest?.locales?.map((l) => l.code) ?? [];
  const availableSet = new Set<string>([...bundledLanguages, ...manifestLanguages]);

  // Filter countries to those that have translations available.
  const list = fixtures.countries
    .filter((c: any) => {
      const ioc = c.ioc?.toUpperCase();
      const lang = iocToLang[ioc];
      return lang && availableSet.has(lang);
    })
    .map((country: any) => ({
      label: fixtures.countryToFlag(country.iso || '') + ' ' + country.label,
      value: country.ioc?.toUpperCase(),
    }));

  // If no translations are available at all (e.g. fresh install, CFS unreachable, no bundled),
  // fall back to showing all mapped countries so the modal isn't empty.
  const displayList =
    list.length > 0
      ? list
      : fixtures.countries
          .filter((c: any) => iocToLang[c.ioc?.toUpperCase()])
          .map((country: any) => ({
            label: fixtures.countryToFlag(country.iso || '') + ' ' + country.label,
            value: country.ioc?.toUpperCase(),
          }));

  let selectedIoc: string | undefined;
  const typeAheadCallback = (value: any) => (selectedIoc = value.value);

  const content = (elem: HTMLElement) => {
    renderForm(elem, [
      {
        typeAhead: { list: displayList, callback: typeAheadCallback, currentValue: preferencesConfig.get().ioc?.toUpperCase() || 'GBR' },
        placeholder: t('phrases.selectlanguage'),
        label: t('cnt'),
        field: 'ioc',
      },
    ]);
  };

  const saveLanguage = async () => {
    if (!selectedIoc) return;
    const lang = iocToLang[selectedIoc] || 'en';

    // If the locale isn't bundled, fetch it from CFS before switching i18next.
    if (!bundledLanguages.includes(lang) && manifestLanguages.includes(lang)) {
      await ensureLocaleCurrent(lang);
    }
    void i18next.changeLanguage(lang);

    // Mark as user-explicit so provider default-language doesn't override on next boot.
    persistConfigToStorage({ language: lang, languageExplicit: true });
  };

  openModal({
    title: t('phrases.selectlanguage'),
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('common.save'), onClick: saveLanguage, close: true },
    ],
    content,
  });
}
