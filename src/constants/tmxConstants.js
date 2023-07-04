import { drawDefinitionConstants, entryStatusConstants, factoryConstants } from 'tods-competition-factory';

const { AFTER_REST, FOLLOWED_BY, NEXT_AVAILABLE, NOT_BEFORE, TO_BE_ANNOUNCED } = factoryConstants.timeItemConstants;
const { SCHEDULE_ERROR, SCHEDULE_CONFLICT, SCHEDULE_WARNING } =factoryConstants.scheduleConstants;

const { MAIN } = drawDefinitionConstants;
const {
  ORGANISER_ACCEPTANCE,
  DIRECT_ACCEPTANCE,
  SPECIAL_EXEMPT,
  JUNIOR_EXEMPT,
  WILDCARD
} = entryStatusConstants;

// selectors
export const ALL_GENDERS = 'All genders';
export const ALL_EVENTS = 'All events';
export const ALL_TEAMS = 'All teams';

// extensions
export const REGISTRATION = 'REGISTRATION';

// root
export const TIMEPICKER = 'timepicker';
export const TIMEVALUE = 'timevalue';

export const TMX_CONTENT = 'tmxContent';
export const TMX_DRAWER = 'tmxDrawer';
export const TMX_MODAL = 'tmxModal';
export const TMX_NAV = 'tmxNav';
export const NAVBAR = 'navbar';
export const SPLASH = 'splash';
export const HOME = 'home';

// user
export const SUPER_ADMIN = 'SUPER_ADMIN';

// engines
export const COMPETITION_ENGINE = 'competitionEngine';
export const TOURNAMENT_ENGINE = 'tournamentEngine';

// router
export const TMX_TOURNAMENTS = 'tournaments';
export const DRAW_ENTRIES = 'drawEntries';
export const TOURNAMENT = 'tournament';
export const STRUCTURE = 'structure';
export const INVITE = 'invite';
export const EVENT = 'event';
export const DRAW = 'draw';

// tabs
export const TOURNAMENT_EVENTS = 'tournamentEvents';
export const TOURNAMENT_OVERVIEW = 'overview';
export const PARTICIPANTS = 'participants';
export const SCHEDULE_TAB = 'schedule';
export const MATCHUPS_TAB = 'matchUps';
export const EVENTS_TAB = 'events';
export const VENUES_TAB = 'venues';

export const LEGACY_EVENTS = 'legacyEvents';

// statuses
export const UNSCHEDULED = 'unscheduled';
export const SUCCESS = { success: true };

// scheduling
export const MINIMUM_SCHEDULE_COLUMNS = 10;
// TODO: remove from tmxConstants; use factory exports

export const CONFLICT_PARTICIPANTS = 'participantConflict';
export const CONFLICT_MATCHUP_ORDER = 'matchUpConflict';
export const SCHEDULE_ISSUE_IDS = 'ISSUE_IDS';
export const SCHEDULE_ISSUE = 'ISSUE';

// in order of concern
export const scheduleClass = {
  [SCHEDULE_ERROR]: 'matchup-error',
  [SCHEDULE_CONFLICT]: 'matchup-conflict',
  [SCHEDULE_ISSUE]: 'matchup-issue',
  [SCHEDULE_WARNING]: 'matchup-warning',
}

// elements
export const TOURNAMENT_PARTICIPANTS = 'tournamentParticipants';
export const SCHEDULED_DATE_FILTER = 'scheduledDateFilter';
export const UNSCHEDULED_MATCHUPS = 'unscheduledMatchUps';
export const TOURNAMENTS_CALENDAR = 'tournamentsCalendar';
export const TOURNAMENT_MATCHUPS = 'tournamentMatchUps';
export const TOURNAMENT_SCHEDULE = 'tournamentSchedule';
export const TOURNAMENTS_TABLE = 'tournamentsTable';
export const TOURNAMENT_TEAMS = 'tournamentTeams';
export const OVERLAY_CONTENT = 'overlayContent';
export const TOURNAMENT_VENUES = 'venuesTable';
export const ENTRIES_COUNT = 'entriesCount';
export const EVENTS_TABLE = 'eventsTable';
export const TMX_OVERLAY = 'tmxOverlay';

// entries
export const ENTRIES_VIEW = 'entriesView';
export const DRAWS_VIEW = 'drawsView';

export const QUALIFYING = 'QUALIFYING';
export const ACCEPTED = 'ACCEPTED';

// events
export const EVENT_INFO = 'eventInfo';
export const ACCEPTED_PANEL = 'acceptedPanel';
export const ALTERNATES_PANEL = 'alternatesPanel';
export const QUALIFYING_PANEL = 'qualifyingPanel';
export const UNGROUPED_PANEL = 'ungroupedPanel';
export const WITHDRAWN_PANEL = 'withdrawaPanel';

// control elements
export const UNSCHEDULED_VISIBILITY = 'unscheduledVisibility';
export const TOURNAMENTS_CONTROL = 'tournamentsControl';
export const PARTICIPANT_CONTROL = 'participantControl';
export const UNSCHEDULED_CONTROL = 'unscheduledControl';
export const SCHEDULE_CONTROL = 'scheduleControl';
export const MATCHUPS_CONTROL = 'matchUpsControl';
export const VENUES_CONTROL = 'venuesControl';
export const EVENTS_CONTROL = 'eventsControl';
export const EVENT_CONTROL = 'eventControl';
export const TEAMS_CONTROL = 'teamsControl';

export const CONTROL_BAR = 'controlBar';
export const BUTTON_BAR = 'buttonBar';
export const TMX_PANEL = 'tmxPanel';
export const TMX_TABLE = 'tmxTable';

export const TOURNAMENT_CONTAINER = 'tcContainer';

// control areas
export const OVERLAY = 'overlay';
export const CENTER = 'center';
export const HEADER = 'header';
export const RIGHT = 'right';
export const LEFT = 'left';

export const BOTTOM = 'bottom';
export const TOP = 'top';

// classes
export const SUB_TABLE = 'subTable';

// dom
export const EMPTY_STRING = '';
export const FLEX = 'flex';
export const NONE = 'none';

// table attributes
export const IS_OPEN = 'isOpen';

export const acceptedEntryStatuses = [
  `${MAIN}.${DIRECT_ACCEPTANCE}`,
  `${MAIN}.${ORGANISER_ACCEPTANCE}`,
  `${MAIN}.${SPECIAL_EXEMPT}`,
  `${MAIN}.${JUNIOR_EXEMPT}`,
  `${MAIN}.${WILDCARD}`
];

export const timeModifierText = {
 [AFTER_REST]: 'After rest',
 [FOLLOWED_BY]: 'Followed by',
 [TO_BE_ANNOUNCED]: 'To be announced',
 [NEXT_AVAILABLE]: 'Next available',
 [NOT_BEFORE]: 'Not before',
}

export const timeModifierDisplay = {
 [AFTER_REST]: 'After rest',
 [FOLLOWED_BY]: 'Followed by',
 [TO_BE_ANNOUNCED]: 'TBA',
 [NEXT_AVAILABLE]: 'Next available',
 [NOT_BEFORE]: 'NB',
}