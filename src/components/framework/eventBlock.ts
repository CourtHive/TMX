/**
 * Create event tab block HTML structure.
 * 3-zone layout: compact event selector, tabs bar, and tab content area.
 * When no event is selected, a full-size events table is shown.
 * When an event is selected, the selector compacts and tabs + content appear.
 */
import {
  EVENTS_CONTROL,
  ENTRIES_VIEW,
  TOURNAMENT_EVENTS,
  EVENTS_TABLE,
  EVENT_SELECTOR,
  EVENT_SELECTOR_TABLE,
  EVENT_TABS_BAR,
  EVENT_TAB_CONTENT,
  ACCEPTED_PANEL,
  ALTERNATES_PANEL,
  QUALIFYING_PANEL,
  UNGROUPED_PANEL,
  WITHDRAWN_PANEL,
  DRAW_CONTROL,
  DRAW_FRAME,
  DRAW_RIGHT,
  DRAW_LEFT,
  DRAWS_VIEW,
  POINTS_VIEW,
  EVENT_INFO,
  EVENT_CONTROL,
  TMX_PANEL,
} from 'constants/tmxConstants';

export function eventBlock(): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'is-marginless';
  div.style.width = 'inherit';
  div.id = 'e-tab';

  div.innerHTML = `
  <div class="tab_section events_tab">
    <div class="section">
      <div class='tabHeader foreground'></div>

      <!-- Zone 1: Event Selector (compact when event selected, full-size otherwise) -->
      <div id=${EVENT_SELECTOR} style="width: 100%;">
        <div id=${EVENTS_TABLE}>
          <div id=${EVENTS_CONTROL} class="controlBar"></div>
          <div id=${TOURNAMENT_EVENTS} class="tableClass flexcol flexcenter"> </div>
        </div>
        <div id=${EVENT_SELECTOR_TABLE} style="display: none;"></div>
      </div>

      <!-- Zone 2: Event Tabs Bar (hidden until event selected) -->
      <div id=${EVENT_TABS_BAR} style="display: none; width: 100%;"></div>

      <!-- Zone 3: Tab Content (hidden until event selected) -->
      <div id=${EVENT_TAB_CONTENT} style="display: none; width: 100%;">
        <div id=${EVENT_INFO} class="block" style='display: none; width: 100%;'>
          <div id=${EVENT_CONTROL} class="controlBar" style='min-height: 3em; border-radius: 6px;'></div>
        </div>
        <div id=${ENTRIES_VIEW} style='display: none;'>
          <div id=${ACCEPTED_PANEL} class='tableClass block ${TMX_PANEL}'> </div>
          <div id=${QUALIFYING_PANEL} class='tableClass block ${TMX_PANEL}'> </div>
          <div id=${ALTERNATES_PANEL} class='tableClass block ${TMX_PANEL}'> </div>
          <div id=${UNGROUPED_PANEL} class='tableClass block ${TMX_PANEL}'> </div>
          <div id=${WITHDRAWN_PANEL} class='tableClass block ${TMX_PANEL}'> </div>
        </div>
        <div id=${POINTS_VIEW} style="display: none; width: 100%;"></div>
        <div style="width: 100%; margin: 0">
          <div id=${DRAW_CONTROL}></div>
          <div id=${DRAW_FRAME} class="flexrow flexjustifystart" style="width: 100%">
            <div id=${DRAW_LEFT}></div>
            <div id=${DRAWS_VIEW} style="overflow-x: scroll; width: 100%; display: none;"></div>
            <div id=${DRAW_RIGHT}></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;

  return div;
}
