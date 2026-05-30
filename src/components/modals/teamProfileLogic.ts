/**
 * Pure logic helpers backing `teamProfileModal.ts`.
 *
 * Two responsibilities, each kept side-effect free so unit tests can exercise
 * them without spinning up the factory engine or a DOM:
 *
 * 1. `splitMembership` — partitions a team's members into roster / coaches /
 *    staff buckets given the team participant and the full participant set.
 *    Pre-extraction this function called `tournamentEngine.q.participants()`
 *    directly; threading the participant array in as a parameter lets the
 *    test harness supply a frozen fixture without booting the engine.
 *
 * 2. `jerseySorter` + `parseJersey` — numeric-aware sort comparator with
 *    empty / non-numeric values sinking to the bottom. Used by the Roster
 *    table's Jersey # column.
 */

import { factoryConstants } from 'tods-competition-factory';

const { participantRoles, participantConstants } = factoryConstants;
const { COMPETITOR, COACH } = participantRoles;
const { INDIVIDUAL } = participantConstants;

export type Member = any;

export interface SplitMembership {
  roster: Member[];
  coaches: Member[];
  staff: Member[];
}

/**
 * Partitions a team's membership into three buckets:
 *
 * - **Roster** — the union of `team.individualParticipants` (the
 *   authoritative roster the factory walks for draws / scoring) and any
 *   individual whose `teamAttributes[0].teamName` matches the team name AND
 *   has role COMPETITOR / no role. Union not strict equality so a roster
 *   entry with an empty `teamAttributes` (manual lineup, pre-import) still
 *   appears, and a freshly-imported COMPETITOR not yet attached to the team
 *   participant (race between the two ADD_PARTICIPANTS mutations) shows up
 *   immediately.
 * - **Coaches** — individuals matched on `teamAttributes.teamName` with
 *   `participantRole === COACH`. Never appear in `individualParticipantIds`
 *   because `createTeamsFromParticipantAttributes` filters them out.
 * - **Staff** — anything else with a matching `teamAttributes.teamName`
 *   (MEDICAL / CAPTAIN / OFFICIAL / VOLUNTEER / PHYSIO / TRAINER / …).
 */
export function splitMembership(team: any, allParticipants: Member[]): SplitMembership {
  const teamName: string | undefined = team?.participantName;
  const teamRoster: Member[] = Array.isArray(team?.individualParticipants) ? team.individualParticipants : [];
  const rosterIds = new Set(teamRoster.map((m: Member) => m.participantId));

  const associated = teamName
    ? allParticipants.filter((p) => {
        if (p?.participantType !== INDIVIDUAL) return false;
        const recordedTeam = p?.person?.biographicalInformation?.teamAttributes?.[0]?.teamName;
        return recordedTeam === teamName;
      })
    : [];

  const coaches: Member[] = [];
  const staff: Member[] = [];
  const rosterExtras: Member[] = [];

  for (const p of associated) {
    const role = p.participantRole;
    if (!role || role === COMPETITOR) {
      if (!rosterIds.has(p.participantId)) rosterExtras.push(p);
    } else if (role === COACH) {
      coaches.push(p);
    } else {
      staff.push(p);
    }
  }

  return {
    roster: [...teamRoster, ...rosterExtras],
    coaches,
    staff,
  };
}

/**
 * Numeric-aware Jersey # comparator for Tabulator. Empty / non-numeric values
 * sort to the bottom regardless of direction.
 */
export function jerseySorter(a: any, b: any): number {
  const na = parseJersey(a);
  const nb = parseJersey(b);
  if (na == null && nb == null) return 0;
  if (na == null) return 1;
  if (nb == null) return -1;
  return na - nb;
}

export function parseJersey(value: any): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
