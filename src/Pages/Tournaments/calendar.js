import { showTMXcalendar } from 'services/transitions/screenSlaver';
import { getLoginState } from 'services/authentication/loginState';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'tods-competition-factory';
import Interactions from '@event-calendar/interaction';
import { tmx2db } from 'services/storage/tmx2db';
import DayGrid from '@event-calendar/day-grid';
import Calendar from '@event-calendar/core';
import { context } from 'services/context';

// import ResourceTimeGrid from '@event-calendar/resource-time-grid';
// import TimeGrid from '@event-calendar/time-grid';
// import List from '@event-calendar/list';

import { SUCCESS, TOURNAMENT, TOURNAMENTS_CALENDAR } from 'constants/tmxConstants';

let calendar;

export function renderCalendar() {
  const state = getLoginState();
  const providerId = state?.profile?.provider?.providerId;

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
          end: ''
        },
        buttonText: (texts) => {
          texts.resourceTimeGridWeek = 'resources';
          return texts;
        },
        resources: [
          { id: 1, title: 'Resource A' },
          { id: 2, title: 'Resource B' }
        ],
        scrollTime: '09:00:00',
        events: createEvents(data),
        eventClick: openTournament,
        views: {
          // timeGridWeek: { pointer: true },
          // resourceTimeGridWeek: { pointer: true }
        },
        dayMaxEvents: true,
        nowIndicator: true,
        selectable: true
      }
    }
  });

  return { ...SUCCESS, calendar };
}

function openTournament({ event }) {
  console.log(event);
  if (event.id) {
    calendar.destroy();
    const tournamentId = event.id;
    tournamentEngine.reset(); // ensure no tournament is in state
    const tournamentUrl = `/${TOURNAMENT}/${tournamentId}`;
    context.router.navigate(tournamentUrl);
  }
}
function createEvents(data) {
  const extractDate = (dateTime) => dateTime.split('T')[0];

  const events = data.map((tournament) => ({
    title: extractDate(tournament.tournamentName),
    start: extractDate(tournament.startDate),
    extendedProps: { tournamentId: tournament.tournamentId },
    resourceIds: [tournament.tournamentId],
    id: tournament.tournamentId,
    end: tournament.endDate,
    color: '#FE6B64'
  }));
  console.log({ events });
  return events;
}
