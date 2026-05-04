/**
 * Playwright selectors derived from TMX's tmxConstants.ts DOM IDs.
 *
 * These are the stable anchor points for E2E tests. TMX uses these
 * ID constants consistently across the app — they're defined centrally
 * in src/constants/tmxConstants.ts and unlikely to change without an
 * intentional refactor.
 *
 * Usage in tests:
 *   import { S } from '../helpers/selectors';
 *   await page.locator(S.TOURNAMENTS_TABLE).waitFor();
 */

// Prefix helper: all selectors are CSS ID selectors
const id = (name: string) => `#${name}`;

export const S = {
  // Main containers
  TMX_CONTENT: id('tmxContent'),
  TMX_DRAWER: id('tmxDrawer'),
  TMX_MODAL: id('tmxModal'),
  TMX_OVERLAY: id('tmxOverlay'),
  NAVBAR: id('dnav'),
  SPLASH: id('splash'),
  HOME: id('home'),

  // Navigation route icons
  NAV_OVERVIEW: id('o-route'),
  NAV_PARTICIPANTS: id('p-route'),
  NAV_EVENTS: id('e-route'),
  NAV_MATCHUPS: id('m-route'),
  NAV_SCHEDULE: id('s-route'),
  NAV_SCHEDULE2: id('s2-route'),
  NAV_VENUES: id('v-route'),
  NAV_SETTINGS: id('c-route'),

  // Calendar / tournaments list
  TOURNAMENTS_TABLE: id('tournamentsTable'),
  TOURNAMENTS_CONTROL: id('tournamentsControl'),

  // Tournament overview
  TOURNAMENT_OVERVIEW: id('overview'),

  // Participants
  TOURNAMENT_PARTICIPANTS: id('tournamentParticipants'),
  PARTICIPANT_CONTROL: id('participantControl'),
  TOURNAMENT_TEAMS: id('tournamentTeams'),
  TEAMS_CONTROL: id('teamsControl'),
  TEAM_STATS: id('teamStats'),

  // Events
  EVENTS_TABLE: id('eventsTable'),
  EVENTS_CONTROL: id('eventsControl'),
  EVENT_CONTROL: id('eventControl'),
  EVENT_SELECTOR: id('eventSelector'),
  EVENT_SELECTOR_TABLE: id('eventSelectorTable'),
  EVENT_TABS_BAR: id('eventTabsBar'),
  EVENT_TAB_CONTENT: id('eventTabContent'),
  EVENT_INFO: id('eventInfo'),

  // Entries panels
  ENTRIES_VIEW: id('entriesView'),
  ENTRIES_COUNT: id('entriesCount'),
  ACCEPTED_PANEL: id('acceptedPanel'),
  ALTERNATES_PANEL: id('alternatesPanel'),
  QUALIFYING_PANEL: id('qualifyingPanel'),
  UNGROUPED_PANEL: id('ungroupedPanel'),
  WITHDRAWN_PANEL: id('withdrawaPanel'), // Note: typo matches source

  // Draws
  DRAWS_VIEW: id('drawsView'),
  DRAW_CONTROL: id('drawControl'),
  DRAW_FRAME: id('drawFrame'),
  DRAW_LEFT: id('drawLeft'),
  DRAW_RIGHT: id('drawRight'),

  // MatchUps
  TOURNAMENT_MATCHUPS: id('tournamentMatchUps'),
  MATCHUPS_CONTROL: id('matchUpsControl'),

  // Schedule
  TOURNAMENT_SCHEDULE: id('tournamentSchedule'),
  SCHEDULE_CONTROL: id('scheduleControl'),
  SCHEDULED_DATE_FILTER: id('scheduledDateFilter'),
  UNSCHEDULED_MATCHUPS: id('unscheduledMatchUps'),
  UNSCHEDULED_CONTROL: id('unscheduledControl'),
  UNSCHEDULED_VISIBILITY: id('unscheduledVisibility'),

  // Schedule2
  SCHEDULE2_CONTAINER: id('schedule2Container'),
  SCHEDULE2_CONTROL: id('schedule2Control'),
  TEMPORAL_GRID_CONTAINER: id('temporalGridContainer'),

  // Venues
  TOURNAMENT_VENUES: id('venuesTable'),
  VENUES_CONTROL: id('venuesControl'),

  // Publishing
  PUBLISHING_CONTROL: id('publishingControl'),
  TOURNAMENT_PUBLISHING: id('tournamentPublishing'),

  // Settings
  SETTINGS_CONTROL: id('settingsControl'),
  TOURNAMENT_SETTINGS: id('tournamentSettings'),

  // Shared
  CONTROL_BAR: id('controlBar'),
  BUTTON_BAR: id('buttonBar'),
  SYNC_INDICATOR: id('syncIndicator'),

  // Format Wizard
  FORMAT_WIZARD_CONTENT: id('formatWizardContent'),
  FORMAT_WIZARD_FORM: id('formatWizardForm'),
  FORMAT_WIZARD_RIGHT_PANE: id('formatWizardRightPane'),
  FORMAT_WIZARD_SCALE: id('formatWizardScale'),
  FORMAT_WIZARD_COURTS: id('formatWizardCourts'),
  FORMAT_WIZARD_DAYS: id('formatWizardDays'),
  FORMAT_WIZARD_HOURS_PER_DAY: id('formatWizardHoursPerDay'),
  FORMAT_WIZARD_MIN_FLOOR: id('formatWizardMinFloor'),
  FORMAT_WIZARD_TARGET_CT: id('formatWizardTargetCt'),
  FORMAT_WIZARD_APPETITE: id('formatWizardAppetite'),
} as const;
