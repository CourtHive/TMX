import { createTournamentsTable } from 'components/tables/tournamentsTable/createTournamentsTable';
import { tmxToast } from 'services/notifications/tmxToast';
import { tmx2db } from 'services/storage/tmx2db';
import * as safeJSON from 'utilities/safeJSON';
import { lang } from 'services/translator';
import { context } from 'services/context';
import { db } from 'services/storage/db';

import { ADD_IDIOM, PROVIDER_CALENDAR } from 'constants/comsConstants';

export function processDirective(data) {
  const result = safeJSON.parse({ data });
  const { directive, content } = result || {};

  if (directive) {
    if (directive === PROVIDER_CALENDAR && content.calendar) {
      tmxToast({
        action: {
          onClick: () => loadCalendar({ providerId: content.providerId, calendar: content.calendar }),
          text: 'Load'
        },
        message: 'Calendar Received',
        duration: false
      });
    }
    if (directive.subKey) {
      context.ee.emit('sendKey', directive.subKey);
    }
    if (directive === ADD_IDIOM && content) {
      lang.define(content);
      db.addIdiom(content).then(setIdiom, (error) => console.log('error:', error));
    }
  }

  function setIdiom() {
    context.ee.emit('changeIdiom', { ioc: content.ioc });
  }
}

function loadCalendar({ providerId, calendar }) {
  const done = () => createTournamentsTable();
  if (providerId && calendar) {
    tmx2db.addProvider({ providerId, calendar }).then(done);
  }
}
