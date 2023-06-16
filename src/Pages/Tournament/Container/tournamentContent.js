import { removeAllChildNodes } from 'services/dom/transformers';

import {
  EVENTS_CONTROL,
  MATCHUPS_CONTROL,
  PARTICIPANT_CONTROL,
  SCHEDULE_CONTROL,
  TOURNAMENT_EVENTS,
  VENUES_CONTROL,
  ACCEPTED_PANEL,
  ALTERNATES_PANEL,
  QUALIFYING_PANEL,
  UNGROUPED_PANEL,
  WITHDRAWN_PANEL,
  DRAWS_VIEW,
  EVENT_CONTROL,
  TOURNAMENT_CONTAINER,
  TOURNAMENT_MATCHUPS,
  TOURNAMENT_SCHEDULE,
  TEAMS_CONTROL,
  TOURNAMENT_PARTICIPANTS,
  TOURNAMENT_TEAMS,
  PARTICIPANTS,
  MATCHUPS_TAB,
  SCHEDULE_TAB,
  UNSCHEDULED_MATCHUPS,
  UNSCHEDULED_CONTROL,
  UNSCHEDULED_VISIBILITY,
  VENUES_TAB,
  TOURNAMENT_VENUES,
  NONE,
  SUCCESS,
  EVENTS_TAB
} from 'constants/tmxConstants';

const refMap = {
  [PARTICIPANTS]: 'p-tab',
  [EVENTS_TAB]: 'e-tab',
  [MATCHUPS_TAB]: 'm-tab',
  [SCHEDULE_TAB]: 's-tab',
  [VENUES_TAB]: 'v-tab'
};

export function tournamentContent() {
  const participantsTab = `
         <div id='individuals' class='tab_section participants_tab'>
            <div class='section' style='padding-top: 1em;'>
               <div id='${PARTICIPANT_CONTROL}' class='controlBar'></div>
               <div id='${TOURNAMENT_PARTICIPANTS}' class='tableClass flexcol flexcenter'> </div>
            </div>
         </div>
         <div id='participantGroupings' class='tab_section participants_tab'>
            <div class='section' style='padding-top: 1em;'>
               <div id='${TEAMS_CONTROL}' class='controlBar'></div>
               <div id='${TOURNAMENT_TEAMS}' class='tableClass flexcol flexcenter'> </div>
            </div>
         </div>
        `;

  const scheduleTab = `
         <div class='tab_section sch_tab'>
            <div class='section block' style='padding-top: 1em;'>
               <div id='${UNSCHEDULED_VISIBILITY}' style='width: 100%; display: none;'>
                  <div id='${UNSCHEDULED_CONTROL}' class='controlBar flexcol flexcenter'></div>
                  <div id='${UNSCHEDULED_MATCHUPS}' class='tableClass flexcol flexcenter'></div>
               </div>
               <div>
                  <div id='${SCHEDULE_CONTROL}' class='controlBar flexcol flexcenter'></div>
                  <div id='${TOURNAMENT_SCHEDULE}' class='tableClass flexcol flexcenter'></div>
               </div>
            </div>
         </div>
        `;

  const venuesTab = `
         <div class='tab_section venues_tab'>
            <div class='section' style='padding-top: 1em;'>
               <div id='${VENUES_CONTROL}' class='controlBar'></div>
               <div id='${TOURNAMENT_VENUES}' class='tableClass flexcol flexcenter'></div>
            </div>
         </div>
        `;

  const matchUpsTab = `
         <div class='tab_section matchUps_tab'>
            <div class='section' style='padding-top: 1em;'>
               <div id='${MATCHUPS_CONTROL}' class='controlBar'></div>
               <div id='${TOURNAMENT_MATCHUPS}' class='tableClass flexcol flexcenter'> </div>
            </div>
         </div>
        `;

  const tabs = {
    'p-tab': participantsTab,
    's-tab': scheduleTab,
    'v-tab': venuesTab,
    'm-tab': matchUpsTab
  };

  const contentContainer = document.getElementById(TOURNAMENT_CONTAINER);

  Object.keys(tabs).forEach((id) => {
    const elem = document.createElement('div');
    elem.class = 'is-marginless';
    elem.style = 'width: inherit';
    elem.id = id;
    elem.innerHTML = tabs[id];
    contentContainer.appendChild(elem);
  });

  displayTab(PARTICIPANTS);
}

export function displayTab(reference) {
  if (!Object.keys(refMap).includes(reference)) return false;

  Object.keys(refMap).forEach((key) => {
    const id = refMap[key];
    const element = document.getElementById(id);
    if (element) {
      element.style.display = reference === key ? '' : NONE;
    } else {
      console.log({ key, id, element });
    }
  });

  return { ...SUCCESS };
}

export function removeTournamentContent() {
  const ids = [
    DRAWS_VIEW,
    EVENTS_CONTROL,
    MATCHUPS_CONTROL,
    PARTICIPANT_CONTROL,
    UNSCHEDULED_CONTROL,
    EVENT_CONTROL,
    TEAMS_CONTROL,
    SCHEDULE_CONTROL,
    VENUES_CONTROL,

    ACCEPTED_PANEL,
    ALTERNATES_PANEL,
    QUALIFYING_PANEL,
    UNGROUPED_PANEL,
    WITHDRAWN_PANEL,

    TOURNAMENT_EVENTS,
    TOURNAMENT_MATCHUPS,
    TOURNAMENT_PARTICIPANTS,
    TOURNAMENT_SCHEDULE,
    TOURNAMENT_TEAMS,
    UNSCHEDULED_MATCHUPS,
    TOURNAMENT_VENUES
  ];

  ids.forEach((key) => {
    const id = refMap[key];
    const element = document.getElementById(id);
    element && removeAllChildNodes(element);
  });
}
