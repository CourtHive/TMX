import { ParticipantRoleEnum } from 'tods-competition-factory';

import type { ParticipantRoleUnion } from 'tods-competition-factory';

const { OFFICIAL, COMPETITOR } = ParticipantRoleEnum;

/**
 * Every factory `participantRole` that is neither COMPETITOR nor OFFICIAL. This is the roll-up behind the
 * Staff view, and the option list behind the Staff role select — one source, so the view and the editor
 * cannot disagree about what "staff" means.
 *
 * This was a hard-coded array in `createParticipantsTable`, on the rationale that an explicit list stays
 * visible at the call site and lets us triage new factory roles before surfacing them. The drift it
 * invited arrived instead: the list held 15 of the 17 non-competitor roles, silently omitting SCOREKEEPER
 * and TIMEKEEPER, so a nominated crowd-scorer was invisible in *every* participant view with nothing to
 * indicate a role had been withheld. Triage by omission is indistinguishable from a bug, so it is derived
 * — a role the factory adds now shows up rather than disappearing.
 *
 * Derived from `ParticipantRoleEnum`, which expresses all 19 roles as of factory 6.29.1. It previously
 * derived from the `participantRoles` const module and was typed `string[]`, because the enum carried only
 * 17 — it omitted SCOREKEEPER and TIMEKEEPER while being exempted from the factory's enum/const
 * conformance guard on the false premise that it had no const-module twin. Factory #4674 added both
 * members, so the enum and the const module now agree and the union can type this list honestly.
 */
export const STAFF_ROLES: ParticipantRoleUnion[] = Object.values(ParticipantRoleEnum).filter(
  (role) => role !== COMPETITOR && role !== OFFICIAL,
);
