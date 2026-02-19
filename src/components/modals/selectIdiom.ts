/**
 * Select language/locale idiom modal.
 * Allows country selection with type-ahead and flag display for language switching.
 */
import { renderForm } from 'courthive-components';
import { fixtures } from 'tods-competition-factory';
import { openModal } from './baseModal/baseModal';
import { i18next, t } from 'i18n';
import { env } from 'settings/env';

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
  CHN: 'zh',
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

export function selectIdiom(): void {
  // Build list of available languages from i18next resources
  const availableLanguages = Object.keys(i18next.options?.resources || {});
  const availableSet = new Set(availableLanguages);

  // Filter countries to those that have translations available
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

  // If no translations are loaded beyond 'en', show all mapped countries
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
        typeAhead: { list: displayList, callback: typeAheadCallback, currentValue: env.ioc?.toUpperCase() || 'GBR' },
        placeholder: t('phrases.selectlanguage'),
        label: t('cnt'),
        field: 'ioc',
      },
    ]);
  };

  const saveLanguage = () => {
    if (selectedIoc) {
      const lang = iocToLang[selectedIoc] || 'en';
      i18next.changeLanguage(lang);
    }
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
