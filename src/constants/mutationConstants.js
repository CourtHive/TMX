/*
 * Curated list of factory methods used for mutations
 */

export const ADD_COURTS = 'addCourts';
export const ADD_FLIGHT = 'addFlight';
export const ADD_DRAW_DEFINITION = 'addDrawDefinition';
export const ADD_ADHOC_MATCHUPS = 'addAdHocMatchUps';
export const ADD_DRAW_ENTRIES = 'addDrawEntries';
export const ADD_DRAW_DEFINITION_EXTENSION = 'addDrawDefinitionExtension';
export const ADD_DYNAMIC_RATINGS = 'addDynamicRatings';
export const ADD_EVENT = 'addEvent';
export const ADD_EVENT_ENTRIES = 'addEventEntries';
export const ADD_EVENT_ENTRY_PAIRS = 'addEventEntryPairs';
export const ADD_EVENT_EXTENSION = 'addEventExtension';
export const ADD_INDIVIDUAL_PARTICIPANT_IDS = 'addIndividualParticipantIds';
export const ADD_MATCHUP_SCHEDULE_ITEMS = 'addMatchUpScheduleItems';
export const ADD_ONLINE_RESOURCE = 'addOnlineResource';
export const ADD_PARTICIPANTS = 'addParticipants';
export const ADD_PARTICIPANT_TIME_ITEM = 'addParticipantTimeItem';
export const ADD_PLAYOFF_STRUCTURES = 'addPlayoffStructures';
export const ADD_TOURNAMENT_EXTENSION = 'addTournamentExtension';
export const ADD_TOURNAMENT_TIMEITEM = 'addTournamentTimeItem';
export const ADD_VENUE = 'addVenue';
export const ASSIGN_TIE_MATCHUP_PARTICIPANT_ID = 'assignTieMatchUpParticipantId';
export const ATTACH_FLIGHT_PROFILE = 'attachFlightProfile';
export const ATTACH_QUALIFYING_STRUCTURE = 'attachQualifyingStructure';
export const ATTACH_POLICIES = 'attachPolicies';
export const AUTOMATED_PLAYOFF_POSITIONING = 'automatedPlayoffPositioning';
export const BULK_SCHEDULE_MATCHUPS = 'bulkScheduleMatchUps';
export const DELETE_ADHOC_MATCHUPS = 'deleteAdHocMatchUps';
export const DELETE_DRAW_DEFINITIONS = 'deleteDrawDefinitions';
export const DELETE_FLIGHT_AND_DRAW = 'deleteFlightAndFlightDraw';
export const DELETE_EVENTS = 'deleteEvents';
export const DELETE_PARTICIPANTS = 'deleteParticipants';
export const DELETE_VENUES = 'deleteVenues';
export const DESTROY_PAIR_ENTRIES = 'destroyPairEntries';
export const GENERATE_FLIGHT_PROFILE = 'generateFlightProfile';
export const GENERATE_SEEDING_SCALE_ITEMS = 'generateSeedingScaleItems';
// export const GENERATE_POPULATE_PLAYOFF = 'generateAndPopulatePlayoffStructures';  // => ADD_PLAYOFF_STRUCTURE
// export const GENERATE_POPULATE_RR_PLAYOFF = 'generateAndPopulateRRplayoffStructures'; // => ADD_PLAYOFF_STRUCTURE
export const MODIFY_COURT = 'modifyCourt';
export const MODIFY_EVENT = 'modifyEvent';

export const MODIFY_DRAW_DEFINITION = 'modifyDrawDefinition'; // TODO:

export const MODIFY_ENTRIES_STATUS = 'modifyEntriesStatus';
export const MODIFY_PARTICIPANT = 'modifyParticipant';
export const MODIFY_SIGN_IN_STATUS = 'modifyParticipantsSignInStatus';
export const MODIFY_TIE_FORMAT = 'modifyTieFormmat';
export const MODIFY_VENUE = 'modifyVenue';
export const PRO_AUTO_SCHEDULE = 'proAutoSchedule';
export const PUBLISH_EVENT = 'publishEvent';
export const REMOVE_INDIVIDUAL_PARTICIPANT_IDS = 'removeIndividualParticipantIds';
export const REMOVE_TIE_MATCHUP_PARTICIPANT_ID = 'removeTieMatchUpParticipantId';
export const REMOVE_STRUCTURE = 'removeStructure';
export const RENAME_STRUCTURES = 'renameStructures';
export const RESET_DRAW_DEFINITION = 'resetDrawDefinition';
export const RESET_MATCHUP_LINEUPS = 'resetMatchUpLinesUps';
export const RESET_SCORECARD = 'resetScorecard';
export const SET_MATCHUP_FORMAT = 'setMatchUpFormat';
export const SET_MATCHUP_STATUS = 'setMatchUpStatus';
export const SET_PARTICIPANT_SCALE_ITEMS = 'setParticipantScaleItems';
export const SET_TOURNAMENT_DATES = 'setTournamentDates';
export const SET_TOURNAMENT_NAME = 'setTournamentName';
export const SET_TOURNAMENT_NOTES = 'setTournamentNotes';
export const UNPUBLISH_EVENT = 'unPublishEvent';
