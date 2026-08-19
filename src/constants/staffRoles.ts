import { ParticipantRoleEnum, participantRoles } from 'tods-competition-factory';

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
 * Derived from the `participantRoles` const module (19 values) rather than `ParticipantRoleEnum`, which
 * carries only 17: the enum is missing those same two roles and is exempted from the factory's
 * enum/const conformance guard on the false premise that it has no const-module twin. Typed `string[]`
 * for the same reason — a union that cannot express two live roles must not be allowed to narrow this
 * list back down. See Mentat/planning/TMX_PARTICIPANTS_PERSONNEL_AND_GROUPS.md, "Factory changes required".
 */
export const STAFF_ROLES: string[] = Object.values(participantRoles).filter(
  (role) => role !== COMPETITOR && role !== OFFICIAL,
);
