import {
  EVENTS_CONTROL,
  ENTRIES_VIEW,
  TOURNAMENT_EVENTS,
  EVENTS_TABLE,
  ACCEPTED_PANEL,
  ALTERNATES_PANEL,
  QUALIFYING_PANEL,
  UNGROUPED_PANEL,
  WITHDRAWN_PANEL,
  DRAWS_VIEW,
  EVENT_INFO,
  EVENT_CONTROL,
  TMX_PANEL
} from 'constants/tmxConstants';

export function eventBlock() {
  const div = document.createElement('div');
  div.className = 'is-marginless';
  div.style.width = 'inherit';
  div.id = 'e-tab';

  div.innerHTML = `
  <div class="tab_section events_tab">
    <div class="section" style='padding-top: 1em;'}>
      <div id=${EVENT_INFO} class="block" style='display: none; width: 100%;'}>
        <div id=${EVENT_CONTROL} class="controlBar" style='min-height: 3em; border-radius: 6px;'}></div>
      </div>
      <div id=${EVENTS_TABLE}>
        <div id=${EVENTS_CONTROL} class="controlBar"></div>
        <div id=${TOURNAMENT_EVENTS} class="tableClass flexcol flexcenter">
          {' '}
        </div>
      </div>
      <div id=${ENTRIES_VIEW} style='display: none;'}>
        <div id=${ACCEPTED_PANEL} class='tableClass block ${TMX_PANEL}'>
          {' '}
        </div>
        <div id=${QUALIFYING_PANEL} class='tableClass block ${TMX_PANEL}'>
          {' '}
        </div>
        <div id=${ALTERNATES_PANEL} class='tableClass block ${TMX_PANEL}'>
          {' '}
        </div>
        <div id=${UNGROUPED_PANEL} class='tableClass block ${TMX_PANEL}'>
          {' '}
        </div>
        <div id=${WITHDRAWN_PANEL} class='tableClass block ${TMX_PANEL}'>
          {' '}
        </div>
      </div>
      <div style="background-color: white; width: 100%; margin: 0">
        <div id="drawControl"></div>
        <div
          id=${DRAWS_VIEW}
	  style="overflow-x: scroll; padding: 1em; display: none;"
        ></div>
      </div>
    </div>
  </div>
  `;

  return div;
}
