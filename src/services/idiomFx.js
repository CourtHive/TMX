import { emitTmx, logError } from './messaging/socketIo';
import { timeFormatDefaultLocale } from 'd3';
import { context } from 'services/context';
import { lang } from 'services/translator';
import { db } from 'services/storage/db';
import { env } from 'settings/env';

import { SEND_KEY } from 'constants/comsConstants';

export function changeIdiom({ ioc, initialization }) {
  if (!ioc || typeof ioc !== 'string') {
    return;
  }
  ioc = ioc?.toLowerCase();
  let result = lang.set(ioc); // first see if language loaded
  if (result) {
    let idiomChanged = env.ioc !== ioc && !initialization;
    env.ioc = ioc;
    if (idiomChanged) {
      setIdiom(ioc);
      context.ee.emit('showSplash', { source: 'change idiom' });
    }
    if (result.locale) timeFormatDefaultLocale(result.locale);
  } else {
    db.findIdiom(ioc).then(makeChange, requestIdiom);
  }
  function requestIdiom() {
    if (ioc && ioc.length === 3) {
      emitTmx({ data: { action: SEND_KEY, payload: { key: `${ioc}.idiom` } } });
    }
  }
  function makeChange(cachedIdiom) {
    if (!cachedIdiom) return requestIdiom();
    lang.define(cachedIdiom);
    env.ioc = ioc;
    lang.set(ioc);
    setIdiom(ioc);
    let idiomChanged = env.ioc !== ioc && !initialization;
    if (idiomChanged) {
      context.ee.emit('showSplash', { source: 'change idiom' });
    }
  }
}

export function setIdiom(ioc) {
  let idiom = {
    key: 'defaultIdiom',
    class: 'userInterface',
    ioc: ioc,
  };
  db.addSetting(idiom);
  return true;
}

export function receiveIdiomList(data) {
  context.available_idioms = Object.assign(
    {},
    ...data
      .map((d) => JSON.parse({ data: d }))
      .filter((f) => f)
      .map((i) => ({ [i.ioc]: i })),
  );

  // set timeout to give first-time initialization a chance to load default language file
  setTimeout(function () {
    db.findSetting('defaultIdiom').then(findIdiom, (error) => console.log('error:', error));
  }, 2000);

  function findIdiom(idiom = {}) {
    db.findIdiom(idiom.ioc).then(checkIdiom, (err) => idiomNotFound(err, idiom.ioc));
  }
  function checkIdiom(idiom = { ioc: 'gbr', name: 'English' }) {
    let a = context.available_idioms[idiom.ioc];
    if (a && a.updated !== idiom.updated) {
      let request = `${idiom.ioc}.idiom`;
      emitTmx({ data: { action: SEND_KEY, payload: { key: request.trim() } } });
    }
  }
  function idiomNotFound(err, ioc) {
    if (ioc) logError({ error: `${ioc} idiom not found` });
  }
}
