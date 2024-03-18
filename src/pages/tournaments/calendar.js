import { showTMXcalendar } from 'services/transitions/screenSlaver';
import { getLoginState } from 'services/authentication/loginState';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'tods-competition-factory';
import Interactions from '@event-calendar/interaction';
import { tmx2db } from 'services/storage/tmx2db';
import DayGrid from '@event-calendar/day-grid';
import Calendar from '@event-calendar/core';
import { context } from 'services/context';
import tippy from 'tippy.js';

// import ResourceTimeGrid from '@event-calendar/resource-time-grid';
// import TimeGrid from '@event-calendar/time-grid';
// import List from '@event-calendar/list';

import { SUCCESS, TOURNAMENT, TOURNAMENTS_CALENDAR } from 'constants/tmxConstants';

let calendar;

export function renderCalendar() {
  const state = getLoginState();
  const providerId = state?.provider?.organisationId;

  if (providerId) {
    const showResults = (result) => {
      if (result?.calendar) {
        render(result.calendar);
      } else {
        tmx2db.findAllTournaments().then(render);
      }
    };
    tmx2db.findProvider(providerId).then(showResults);
  } else {
    tmx2db.findAllTournaments().then(render);
  }
}

export function render(data) {
  const calendarAnchor = document.getElementById(TOURNAMENTS_CALENDAR);
  if (calendar) removeAllChildNodes(calendarAnchor);
  showTMXcalendar();

  calendar = new Calendar({
    target: calendarAnchor,
    props: {
      // plugins: [ResourceTimeGrid, DayGrid, TimeGrid, Interactions, List],
      plugins: [DayGrid, Interactions],
      options: {
        view: 'dayGridMonth',
        height: '800px',
        headerToolbar: {
          // start: 'prev,next today',
          start: 'prev,next',
          center: 'title',
          // end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek resourceTimeGridWeek'
          end: '',
        },
        buttonText: (texts) => {
          texts.resourceTimeGridWeek = 'resources';
          return texts;
        },
        resources: [
          { id: 1, title: 'Resource A' },
          { id: 2, title: 'Resource B' },
        ],
        scrollTime: '09:00:00',
        events: createEvents(data),
        eventClick: openTournament,
        eventMouseEnter: eventHover,
        views: {
          // timeGridWeek: { pointer: true },
          // resourceTimeGridWeek: { pointer: true }
        },
        dayMaxEvents: true,
        nowIndicator: true,
        selectableRows: true,
      },
    },
  });

  return { ...SUCCESS, calendar };
}

function openTournament({ event }) {
  if (event.id) {
    calendar.destroy();
    const tournamentId = event.id;
    tournamentEngine.reset(); // ensure no tournament is in state
    const tournamentUrl = `/${TOURNAMENT}/${tournamentId}`;
    context.router.navigate(tournamentUrl);
  }
}
function createEvents(data) {
  const extractDate = (dateTime) => dateTime?.split('T')[0];

  return data.map((record) => ({
    title: record.tournamentName,
    start: extractDate(record.startDate),
    end: extractDate(record.endDate),
    extendedProps: { tournamentId: record.tournamentId },
    resourceIds: [record.tournamentId],
    id: record.tournamentId,
    color: '#FE6B64',
  }));
}

function eventHover({ event, jsEvent }) {
  tippy(jsEvent.target, {
    content: event.title,
    showOnCreate: true,
    arrow: true,
  });
}
