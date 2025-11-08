/**
 * Select language/locale idiom modal.
 * Allows country selection with type-ahead and flag display for language switching.
 */
import { renderForm } from 'components/renderers/renderForm';
// import { getIdioms } from 'services/apis/servicesApi';
import { fixtures } from 'tods-competition-factory';
import { openModal } from './baseModal/baseModal';
import { context } from 'services/context';
import { lang } from 'services/translator';
import { env } from 'settings/env';

export function selectIdiom(): void {
  // const response = (foo: any) => console.log({ foo });
  // getIdioms().then(response, (err: any) => console.log({ err }));

  const validOptions = Object.keys((context as any).available_idioms || []).map((i) => ({
    ioc: i.toUpperCase(),
  }));
  const valid_iocs = validOptions.reduce((p: string[], c) => (c.ioc && p.indexOf(c.ioc) < 0 ? p.concat(c.ioc) : p), []);
  const valid_isos = validOptions.reduce((p: string[], c) => ((c as any).iso && p.indexOf((c as any).iso) < 0 ? p.concat((c as any).iso) : p), []);
  const filteredCountries =
    validOptions.length &&
    fixtures.countries.filter((c: any) => valid_iocs.indexOf(c.ioc) >= 0 || valid_isos.indexOf(c.iso) >= 0);
  const list = (filteredCountries || []).map((country: any) => ({
    label: fixtures.countryToFlag(country.iso || '') + ' ' + country.label,
    value: country.ioc,
  }));

  let newIdiom: any;
  const typeAheadCallback = (value: any) => (newIdiom = value.value);

  const content = (elem: HTMLElement) => {
    renderForm(elem, [
      {
        typeAhead: { list, callback: typeAheadCallback, currentValue: env.ioc?.toUpperCase() || 'GBR' },
        placeholder: 'Country of origin',
        label: 'Country',
        field: 'ioc',
      },
    ]);
  };

  const saveIdiom = () => {
    if (newIdiom) {
      context.ee.emit('changeIdiom', { ioc: newIdiom });
    }
  };
  openModal({
    title: lang.tr('phrases.selectlanguage'),
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Save', onClick: saveIdiom, close: true },
    ],
    content,
  });
}
