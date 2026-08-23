/**
 * Which tournament sections a user has any use for.
 *
 * Hiding individual controls is subtle; hiding whole sections is what makes a
 * restricted posture legible. But there is a trap in the obvious version.
 *
 * ## Write capability alone is the wrong signal
 *
 * Every capability so far answers *"may you change this"*. Navigation needs
 * *"is this section of any use to you"*, and the two diverge. Venues must
 * disappear for a scoring-only user but **must not** disappear for a scheduler:
 * assigning matches to courts needs the venue surface even when creating a venue
 * is denied. Deriving purely from write capability would hide it from exactly
 * the person who needs it — hence `modifySchedule` and `modifyCourtAvailability`
 * appear in the Venues row below.
 *
 * ## Derived, never a second list
 *
 * A tab is visible when **any** of its actions is permitted. Nothing here
 * enumerates permissions independently of `can()`, so a tab cannot drift from
 * the capability set the way a hand-maintained visibility list would.
 *
 * ## Read-useful sections
 *
 * A short, explicit exemption for sections a user must SEE without being able to
 * change anything. A recorder needs to know where and when they are playing.
 * Keep this list small and justified — every entry weakens the lockdown.
 */
import { can } from './can';

import type { CapabilityAction, Capability } from './can';
import {
  TOURNAMENT_OVERVIEW,
  REGISTRATIONS_TAB,
  PUBLISHING_TAB,
  SCHEDULING_TAB,
  PARTICIPANTS,
  MATCHUPS_TAB,
  SETTINGS_TAB,
  REPORTS_TAB,
  VENUES_TAB,
  EVENTS_TAB,
} from 'constants/tmxConstants';

/**
 * Actions that give a tab purpose. Empty array = always available.
 *
 * Registrations is absent deliberately: it already has its own richer gate
 * (`canManageRegistrations`, which reads the tournament's registrationProfile as
 * well as the caller's provider authority) and this must not second-guess it.
 */
const TAB_ACTIONS: Record<string, CapabilityAction[]> = {
  [TOURNAMENT_OVERVIEW]: [],
  [SETTINGS_TAB]: [], // user preferences — language, scoring approach, fonts
  [PARTICIPANTS]: [
    'createCompetitor',
    'createOfficial',
    'importParticipants',
    'deleteParticipants',
    'editParticipantDetails',
    'modifyEntries',
  ],
  [EVENTS_TAB]: [
    'createEvent',
    'deleteEvent',
    'createDraw',
    'deleteDraw',
    'assignPositions',
    'modifyStructures',
    'modifyEntries',
  ],
  [MATCHUPS_TAB]: ['enterScores', 'modifySchedule'],
  [SCHEDULING_TAB]: ['modifySchedule', 'useBulkScheduling'],
  // Not just venue CRUD: a scheduler needs this surface to place matches on courts.
  [VENUES_TAB]: ['createVenue', 'deleteVenue', 'modifySchedule'],
  [PUBLISHING_TAB]: ['publish', 'unpublish'],
  [REPORTS_TAB]: ['publish'],
};

/**
 * Sections visible even when every action on them is denied, because seeing
 * them is the point. A recorder scoring on court 7 needs to know when and where
 * they are playing.
 */
const READ_USEFUL_TABS: ReadonlySet<string> = new Set([MATCHUPS_TAB, SCHEDULING_TAB]);

/** Tabs whose visibility this module does NOT own. */
const EXTERNALLY_GATED: ReadonlySet<string> = new Set([REGISTRATIONS_TAB]);

export function ownsTabVisibility(tab: string): boolean {
  return !EXTERNALLY_GATED.has(tab) && tab in TAB_ACTIONS;
}

/**
 * May this user reach this tab at all?
 *
 * MUST be evaluated at render — a provider's effective config is re-fetched on
 * impersonation switch and a demo posture can change between renders.
 */
export function canViewTab(tab: string): boolean {
  if (!ownsTabVisibility(tab)) return true;
  if (READ_USEFUL_TABS.has(tab)) return true;
  const actions = TAB_ACTIONS[tab];
  if (!actions.length) return true;
  return actions.some((action) => can(action).allowed);
}

/**
 * Why a tab is unavailable — the reason from the first action that would have
 * granted it. Feeds the redirect toast, so a deep link explains itself rather
 * than silently bouncing.
 */
export function tabDenialReason(tab: string): string | undefined {
  if (canViewTab(tab)) return undefined;
  for (const action of TAB_ACTIONS[tab] ?? []) {
    const result: Capability = can(action);
    if (!result.allowed) return result.reason;
  }
  return undefined;
}

/** The first tab this user can reach — where a denied deep link lands. */
export function firstPermittedTab(): string {
  const order = [
    TOURNAMENT_OVERVIEW,
    MATCHUPS_TAB,
    SCHEDULING_TAB,
    EVENTS_TAB,
    PARTICIPANTS,
    VENUES_TAB,
    PUBLISHING_TAB,
    REPORTS_TAB,
    SETTINGS_TAB,
  ];
  return order.find((tab) => canViewTab(tab)) ?? TOURNAMENT_OVERVIEW;
}

/** Exported for the coverage test and for demo tooling. */
export const NAV_TAB_ACTIONS: Readonly<Record<string, CapabilityAction[]>> = TAB_ACTIONS;
