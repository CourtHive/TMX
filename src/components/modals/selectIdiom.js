import { countries, countryToFlag } from 'assets/countryData';
import { renderForm } from 'components/renderers/renderForm';
import { getIdioms } from 'services/apis/servicesApi';
import { context } from 'services/context';
import { lang } from 'services/translator';
import { env } from 'settings/env';

export function selectIdiom() {
  const response = (foo) => console.log(foo);
  getIdioms().then(response, (err) => console.log({ err }));

  let validOptions = Object.keys(context.available_idioms || []).map((i) => ({
    ioc: i.toUpperCase()
  }));
  const valid_iocs = validOptions.reduce((p, c) => (c.ioc && p.indexOf(c.ioc) < 0 ? p.concat(c.ioc) : p), []);
  const valid_isos = validOptions.reduce((p, c) => (c.iso && p.indexOf(c.iso) < 0 ? p.concat(c.iso) : p), []);
  const filteredCountries =
    validOptions.length && countries.filter((c) => valid_iocs.indexOf(c.ioc) >= 0 || valid_isos.indexOf(c.iso) >= 0);
  const list = (filteredCountries || []).map((country) => ({
    label: countryToFlag(country.iso || '') + ' ' + country.label,
    value: country.ioc
  }));

  let newIdiom;
  const typeAheadCallback = (value) => (newIdiom = value.value);

  const content = (elem) => {
    renderForm(elem, [
      {
        typeAhead: { list, callback: typeAheadCallback, currentValue: env.ioc?.toUpperCase() || 'GBR' },
        placeholder: 'Country of origin',
        label: 'Country',
        field: 'ioc'
      }
    ]);
  };

  const saveIdiom = () => {
    if (newIdiom) {
      context.ee.emit('changeIdiom', { ioc: newIdiom });
    }
  };
  context.modal.open({
    title: lang.tr('phrases.selectlanguage'),
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Save', onClick: saveIdiom, close: true }
    ],
    content
  });
}
