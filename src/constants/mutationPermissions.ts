/**
 * Mutation method → provider permission key map.
 *
 * Used by `mutationRequest()` to gate mutations against
 * `providerConfig.isAllowed(permKey)`. Defense in depth: UI surfaces
 * also hide buttons for the same permissions, but this layer rejects
 * even programmatic mutations (dev console / replay attacks).
 *
 * Mutations not in this map are allowed by default. Add new entries
 * here when introducing a mutation that maps to a lockable behavior;
 * see `Mentat/planning/TMX_PROVIDER_CONFIG_FEATURES.md` Section 7.
 */
import {
  ADD_DRAW_DEFINITION,
  ADD_EVENT,
  ADD_FLIGHT,
  ADD_MATCHUP_OFFICIAL,
  ADD_MATCHUP_SCHEDULE_ITEMS,
  ADD_PARTICIPANTS,
  ADD_VENUE,
  ATTACH_FLIGHT_PROFILE,
  ATTACH_POLICIES,
  BULK_SCHEDULE_MATCHUPS,
  DELETE_ADHOC_MATCHUPS,
  DELETE_DRAW_DEFINITIONS,
  DELETE_EVENTS,
  DELETE_FLIGHT_AND_DRAW,
  DELETE_PARTICIPANTS,
  DELETE_VENUES,
  MODIFY_COURT,
  MODIFY_COURT_AVAILABILITY,
  MODIFY_DRAW_DEFINITION,
  MODIFY_ENTRIES_STATUS,
  MODIFY_EVENT,
  MODIFY_PARTICIPANT,
  MODIFY_PARTICIPANT_OTHER_NAME,
  MODIFY_SIGN_IN_STATUS,
  MODIFY_TIE_FORMAT,
  MODIFY_VENUE,
  PRO_AUTO_SCHEDULE,
  PUBLISH_EVENT,
  PUBLISH_EVENT_SEEDING,
  PUBLISH_ORDER_OF_PLAY,
  PUBLISH_PARTICIPANTS,
  SET_MATCHUP_FORMAT,
  SET_REGISTRATION_PROFILE,
  SET_TOURNAMENT_DATES,
  SET_TOURNAMENT_LOCAL_TIME_ZONE,
  SET_TOURNAMENT_NAME,
  SET_TOURNAMENT_NOTES,
  UNPUBLISH_EVENT,
  UNPUBLISH_EVENT_SEEDING,
  UNPUBLISH_ORDER_OF_PLAY,
  UNPUBLISH_PARTICIPANTS,
} from 'constants/mutationConstants';

import { providerConfig, type ProviderPermissions } from 'config/providerConfig';

export const MUTATION_PERMISSIONS: Record<string, keyof ProviderPermissions> = {
  // Participants
  [ADD_PARTICIPANTS]: 'canCreateCompetitors',
  [DELETE_PARTICIPANTS]: 'canDeleteParticipants',
  [MODIFY_PARTICIPANT]: 'canEditParticipantDetails',
  [MODIFY_PARTICIPANT_OTHER_NAME]: 'canEditParticipantDetails',
  [MODIFY_SIGN_IN_STATUS]: 'canEditParticipantDetails',
  [MODIFY_ENTRIES_STATUS]: 'canEditParticipantDetails',

  // Officials (proxy via match-official assignment — there's no dedicated
  // ADD_OFFICIAL mutation since officials enter as PARTICIPANTS but the
  // assignment-to-matchUp surface is the gate-worthy one)
  [ADD_MATCHUP_OFFICIAL]: 'canCreateOfficials',

  // Events
  [ADD_EVENT]: 'canCreateEvents',
  [DELETE_EVENTS]: 'canDeleteEvents',
  [MODIFY_EVENT]: 'canModifyEventFormat',
  [SET_MATCHUP_FORMAT]: 'canModifyEventFormat',
  [MODIFY_TIE_FORMAT]: 'canModifyEventFormat',

  // Draws
  [ADD_DRAW_DEFINITION]: 'canCreateDraws',
  [ADD_FLIGHT]: 'canCreateDraws',
  [ATTACH_FLIGHT_PROFILE]: 'canCreateDraws',
  [MODIFY_DRAW_DEFINITION]: 'canCreateDraws',
  [DELETE_DRAW_DEFINITIONS]: 'canDeleteDraws',
  [DELETE_ADHOC_MATCHUPS]: 'canDeleteDraws',
  [DELETE_FLIGHT_AND_DRAW]: 'canDeleteDraws',

  // Scheduling
  [ADD_MATCHUP_SCHEDULE_ITEMS]: 'canModifySchedule',
  [BULK_SCHEDULE_MATCHUPS]: 'canModifySchedule',
  [PRO_AUTO_SCHEDULE]: 'canModifySchedule',

  // Venues + courts
  [ADD_VENUE]: 'canCreateVenues',
  [DELETE_VENUES]: 'canDeleteVenues',
  [MODIFY_VENUE]: 'canCreateVenues', // edit-venue gates on create-venue ceiling
  [MODIFY_COURT]: 'canModifyCourtAvailability',
  [MODIFY_COURT_AVAILABILITY]: 'canModifyCourtAvailability',

  // Tournament details
  [SET_TOURNAMENT_DATES]: 'canModifyTournamentDetails',
  [SET_TOURNAMENT_NAME]: 'canModifyTournamentDetails',
  [SET_TOURNAMENT_LOCAL_TIME_ZONE]: 'canModifyTournamentDetails',
  [SET_TOURNAMENT_NOTES]: 'canModifyTournamentDetails',
  [SET_REGISTRATION_PROFILE]: 'canModifyTournamentDetails',

  // Tournament policies
  [ATTACH_POLICIES]: 'canModifyPolicies',

  // Publishing
  [PUBLISH_EVENT]: 'canPublish',
  [PUBLISH_ORDER_OF_PLAY]: 'canPublish',
  [PUBLISH_PARTICIPANTS]: 'canPublish',
  [PUBLISH_EVENT_SEEDING]: 'canPublish',
  [UNPUBLISH_EVENT]: 'canUnpublish',
  [UNPUBLISH_ORDER_OF_PLAY]: 'canUnpublish',
  [UNPUBLISH_PARTICIPANTS]: 'canUnpublish',
  [UNPUBLISH_EVENT_SEEDING]: 'canUnpublish',
};

export function isMutationAllowed(method: string): boolean {
  const permKey = MUTATION_PERMISSIONS[method];
  if (!permKey) return true; // Unmapped mutations allowed by default
  return providerConfig.isAllowed(permKey);
}
