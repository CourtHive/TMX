/**
 * Tournament calendar view using event-calendar library.
 * Displays tournaments in a monthly calendar format.
 */
import { showTMXcalendar } from 'services/transitions/screenSlaver';
import { getLoginState } from 'services/authentication/loginState';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'tods-competition-factory';
import Interactions from '@event-calendar/interaction';
import { createCalendar } from '@event-calendar/core';
import { tmx2db } from 'services/storage/tmx2db';
import DayGrid from '@event-calendar/day-grid';
import { context } from 'services/context';
import tippy from 'tippy.js';

import { SUCCESS, TOURNAMENT, TOURNAMENTS_CALENDAR } from 'constants/tmxConstants';

let calendar: any;

export function renderCalendar(): void {
  const state = getLoginState();
  const providerId = state?.provider?.organisationId;

  if (providerId) {
    const showResults = (result: any) => {
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

export function render(data: any[]): any {
  const calendarAnchor = document.getElementById(TOURNAMENTS_CALENDAR);
  if (calendar && calendarAnchor) removeAllChildNodes(calendarAnchor);
  showTMXcalendar();

  if (!calendarAnchor) return;

  calendar = createCalendar(calendarAnchor, {
    plugins: [DayGrid, Interactions],
    options: {
      view: 'dayGridMonth',
      height: '800px',
      headerToolbar: {
        start: 'prev,next',
        center: 'title',
        end: '',
      },
      buttonText: (texts: any) => {
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
      views: {},
      dayMaxEvents: true,
      nowIndicator: true,
      selectable: true,
    },
  });

  return { ...SUCCESS, calendar };
}

function openTournament({ event }: any): void {
  if (event.id) {
    calendar.destroy();
    const tournamentId = event.id;
    tournamentEngine.reset();
    const tournamentUrl = `/${TOURNAMENT}/${tournamentId}`;
    context.router.navigate(tournamentUrl);
  }
}

function createEvents(data: any[]): any[] {
  const extractDate = (dateTime: string) => dateTime?.split('T')[0];

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

function eventHover({ event, jsEvent }: any): void {
  tippy(jsEvent.target, {
    content: event.title,
    showOnCreate: true,
    arrow: true,
  });
}
