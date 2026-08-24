/**
 * Tournament content container and tab management.
 * Creates and manages tournament tab structure and visibility.
 */
import { removeAllChildNodes } from 'services/dom/transformers';

import {
  EVENTS_CONTROL,
  MATCHUPS_CONTROL,
  PARTICIPANT_CONTROL,
  TOURNAMENT_EVENTS,
  VENUES_CONTROL,
  ACCEPTED_PANEL,
  ALTERNATES_PANEL,
  QUALIFYING_PANEL,
  UNGROUPED_PANEL,
  WITHDRAWN_PANEL,
  DRAWS_VIEW,
  POINTS_VIEW,
  EVENT_CONTROL,
  TOURNAMENT_CONTAINER,
  TOURNAMENT_MATCHUPS,
  TEAMS_CONTROL,
  TOURNAMENT_PARTICIPANTS,
  TOURNAMENT_TEAMS,
  PARTICIPANTS,
  MATCHUPS_TAB,
  OFFICIALS_TAB,
  OFFICIALS_CONTROL,
  TOURNAMENT_OFFICIALS,
  PUBLISHING_TAB,
  PUBLISHING_CONTROL,
  TOURNAMENT_PUBLISHING,
  SCHEDULING_TAB,
  SCHEDULING_CONTAINER,
  SCHEDULING_CONTROL,
  VENUES_TAB,
  AVAILABILITY_GRID_CONTAINER,
  TOURNAMENT_VENUES,
  NONE,
  SUCCESS,
  EVENTS_TAB,
  TOURNAMENT_OVERVIEW,
  TEAM_STATS,
  SETTINGS_TAB,
  SETTINGS_CONTROL,
  TOURNAMENT_SETTINGS,
  REPORTS_TAB,
  REPORTS_CONTROL,
  TOURNAMENT_REPORTS,
  REGISTRATIONS_TAB,
  REGISTRATIONS_CONTROL,
  TOURNAMENT_REGISTRATIONS,
} from 'constants/tmxConstants';

const refMap: Record<string, string> = {
  [TOURNAMENT_OVERVIEW]: 'o-tab',
  [PARTICIPANTS]: 'p-tab',
  [EVENTS_TAB]: 'e-tab',
  [MATCHUPS_TAB]: 'm-tab',
  [OFFICIALS_TAB]: 'of-tab',
  [SCHEDULING_TAB]: 'sw-tab',
  [VENUES_TAB]: 'v-tab',
  [PUBLISHING_TAB]: 'b-tab',
  [REPORTS_TAB]: 'r-tab',
  [REGISTRATIONS_TAB]: 'rg-tab',
  [SETTINGS_TAB]: 'c-tab',
};

export function tournamentContent(): void {
  const participantsTab = `
        <div id='individuals' class='tab_section participants_tab'>
          <div class='section'>
            <div class='tabHeader foreground'>Participants</div>
            <div id='${PARTICIPANT_CONTROL}' class='controlBar'></div>
            <div id='${TOURNAMENT_PARTICIPANTS}' class='tableClass flexcol flexcenter'> </div>
          </div>
        </div>
        <div id='participantGroupings' class='tab_section participants_tab'>
            <div class='section'>
              <div class='tabHeader foreground'></div>
              <div id='${TEAMS_CONTROL}' class='controlBar'></div>
              <div id='${TOURNAMENT_TEAMS}' class='tableClass flexcol flexcenter'> </div>
            </div>
        </div>
        `;

  // The workspace claims whatever the header above it leaves, rather than
  // subtracting a hard-coded 140px for chrome that actually measures ~95px and
  // parking its action bar 45px above the fold.
  //
  // `height: 0` is the load-bearing part, and the counter-intuitive one: a flex
  // item propagates its CONTENT height into its ancestors' intrinsic sizing even
  // with `flex-basis: 0`, so the grid's natural height pushed the whole shell
  // 536px past the fold. A definite height contributes itself instead, and
  // flex-grow then hands the item the leftover space. The grid inside scrolls
  // on its own, which is what `min-height: 0` allows.
  const schedulingTab = `
        <div class='tab_section scheduling_tab'>
            <div class='section block'>
              <div id='${SCHEDULING_CONTROL}' class='controlBar flexcol flexcenter'></div>
              <div id='${SCHEDULING_CONTAINER}' style='width: 100%; height: 0; flex: 1 1 auto; min-height: 0;'></div>
            </div>
        </div>
        `;

  const officialsTab = `
        <div class='tab_section officials_tab'>
            <div class='section'>
              <div class='tabHeader foreground'></div>
              <div id='${OFFICIALS_CONTROL}' class='controlBar'></div>
              <div id='${TOURNAMENT_OFFICIALS}' class='tableClass flexcol flexcenter'></div>
            </div>
        </div>
        `;

  const venuesTab = `
        <div class='tab_section venues_tab'>
            <div class='section'>
              <div class='tabHeader foreground'></div>
              <div id='${VENUES_CONTROL}' class='controlBar'></div>
              <div id='${TOURNAMENT_VENUES}' class='tableClass flexcol flexcenter'></div>
              <div id='${AVAILABILITY_GRID_CONTAINER}' style='display: none; width: 100%; height: 75vh; overflow: hidden;'></div>
            </div>
        </div>
        `;

  const matchUpsTab = `
        <div class='tab_section matchUps_tab'>
            <div class='section'>
              <div class='tabHeader foreground'></div>
              <div id='${MATCHUPS_CONTROL}' class='controlBar'></div>
              <div id='${TEAM_STATS}' class='controlBar'></div>
              <div id='${TOURNAMENT_MATCHUPS}' class='tableClass flexcol flexcenter'> </div>
            </div>
        </div>
        `;

  const settingsTab = `
        <div class='tab_section settings_tab'>
            <div class='section'>
              <div id='${SETTINGS_CONTROL}' class='controlBar'></div>
              <div id='${TOURNAMENT_SETTINGS}'></div>
            </div>
        </div>
        `;

  const publishingTab = `
        <div class='tab_section publishing_tab'>
            <div class='section'>
              <div id='${PUBLISHING_CONTROL}' class='controlBar'></div>
              <div id='${TOURNAMENT_PUBLISHING}'></div>
            </div>
        </div>
        `;

  const reportsTab = `
        <div class='tab_section reports_tab'>
            <div class='section'>
              <div id='${REPORTS_CONTROL}' class='controlBar'></div>
              <div id='${TOURNAMENT_REPORTS}' class='tableClass flexcol flexcenter'></div>
            </div>
        </div>
        `;

  const registrationsTab = `
        <div class='tab_section registrations_tab'>
            <div class='section'>
              <div id='${REGISTRATIONS_CONTROL}' class='controlBar'></div>
              <div id='${TOURNAMENT_REGISTRATIONS}' class='tableClass flexcol flexcenter'></div>
            </div>
        </div>
        `;

  const tabs: Record<string, string> = {
    'p-tab': participantsTab,
    'sw-tab': schedulingTab,
    'v-tab': venuesTab,
    'm-tab': matchUpsTab,
    'of-tab': officialsTab,
    'r-tab': reportsTab,
    'rg-tab': registrationsTab,
    'b-tab': publishingTab,
    'c-tab': settingsTab,
  };

  const contentContainer = document.getElementById(TOURNAMENT_CONTAINER)!;

  Object.keys(tabs).forEach((id) => {
    const elem = document.createElement('div');
    elem.className = 'is-marginless tab_container';
    elem.style.cssText = 'width: inherit';
    elem.id = id;
    elem.innerHTML = tabs[id];
    contentContainer.appendChild(elem);
  });

  displayTab(PARTICIPANTS);
}

export function displayTab(reference: string): any {
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

export function removeTournamentContent(): void {
  const ids = [
    DRAWS_VIEW,
    POINTS_VIEW,
    EVENTS_CONTROL,
    MATCHUPS_CONTROL,
    PARTICIPANT_CONTROL,
    EVENT_CONTROL,
    TEAMS_CONTROL,
    VENUES_CONTROL,

    TEAM_STATS,

    ACCEPTED_PANEL,
    ALTERNATES_PANEL,
    QUALIFYING_PANEL,
    UNGROUPED_PANEL,
    WITHDRAWN_PANEL,

    TOURNAMENT_EVENTS,
    TOURNAMENT_MATCHUPS,
    TOURNAMENT_PARTICIPANTS,
    TOURNAMENT_TEAMS,
    TOURNAMENT_VENUES,
    AVAILABILITY_GRID_CONTAINER,
    TOURNAMENT_PUBLISHING,
    REPORTS_CONTROL,
    TOURNAMENT_REPORTS,
    REGISTRATIONS_CONTROL,
    TOURNAMENT_REGISTRATIONS,
  ];

  ids.forEach((key) => {
    const id = refMap[key];
    const element = document.getElementById(id);
    if (element) removeAllChildNodes(element);
  });
}
