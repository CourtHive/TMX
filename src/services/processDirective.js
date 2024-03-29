import { createTournamentsTable } from 'components/tables/tournamentsTable/createTournamentsTable';
import { tmxToast } from 'services/notifications/tmxToast';
import { tmx2db } from 'services/storage/tmx2db';
import * as safeJSON from 'utilities/safeJSON';
import { context } from 'services/context';

import { PROVIDER_CALENDAR } from 'constants/comsConstants';

export function processDirective(data) {
  const result = safeJSON.parse({ data });
  const { directive, content } = result || {};

  if (directive) {
    if (directive === PROVIDER_CALENDAR && content.calendar) {
      tmxToast({
        action: {
          onClick: () => loadCalendar({ providerId: content.providerId, calendar: content.calendar }),
          text: 'Load',
        },
        message: 'Calendar Received',
        duration: false,
      });
    }
    if (directive.subKey) {
      context.ee.emit('sendKey', directive.subKey);
    }
  }
}

function loadCalendar({ providerId, calendar }) {
  const done = () => createTournamentsTable();
  if (providerId && calendar) {
    tmx2db.addProvider({ providerId, calendar }).then(done);
  }
}
