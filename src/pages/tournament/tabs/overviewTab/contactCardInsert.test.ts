import { isContactCardPersonnel } from './contactCardInsert';
import { participantRoles } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

/**
 * The overview contact card filtered on ROLE alone: `participantRole && participantRole !== COMPETITOR`.
 *
 * `getParticipants` is called with no `participantFilters`, so GROUPs arrive — and every GROUP the UI
 * creates carries a role, because the group role select offers OTHER / COACH / MEDICAL / PHYSIO /
 * TRAINER. A GROUP has no `person`, so the name fell through to `participantName` and a row appeared
 * that read as a person named "Transport Van A" with a role and no contact details.
 *
 * The exact inverse of factory #4684, where the entry gate tested type and forgot role.
 */

const { COACH, COMPETITOR, OFFICIAL, PHYSIO } = participantRoles;

const individual = (participantRole?: string) => ({
  participantId: 'p1',
  participantType: 'INDIVIDUAL',
  participantRole,
});

describe('isContactCardPersonnel', () => {
  it('admits staff and officials', () => {
    expect(isContactCardPersonnel(individual(OFFICIAL))).toBe(true);
    expect(isContactCardPersonnel(individual(PHYSIO))).toBe(true);
  });

  it('REJECTS a role-bearing GROUP — the bug', () => {
    // "Transport Van A": a group carrying a role, no person, rendered as a human being.
    const group = {
      participantId: 'g1',
      participantType: 'GROUP',
      participantRole: COACH,
      participantName: 'Transport Van A',
    };
    expect(isContactCardPersonnel(group)).toBe(false);
  });

  it('rejects a TEAM and a PAIR, which also carry roles and no person', () => {
    expect(isContactCardPersonnel({ participantType: 'TEAM', participantRole: COMPETITOR })).toBe(false);
    expect(isContactCardPersonnel({ participantType: 'PAIR', participantRole: COMPETITOR })).toBe(false);
  });

  it('rejects competitors — the card is for personnel', () => {
    expect(isContactCardPersonnel(individual(COMPETITOR))).toBe(false);
  });

  it('rejects an individual with no role', () => {
    // Deliberately the OPPOSITE of the competitor-facing filters elsewhere. Those ask "is this a
    // player?", where an absent role means yes. This asks "is this personnel?", where an absent role
    // means there is nothing to put in the role column — the card renders a role label per row.
    expect(isContactCardPersonnel(individual(undefined))).toBe(false);
  });

  it('tolerates malformed entries without throwing', () => {
    expect(isContactCardPersonnel(undefined)).toBe(false);
    expect(isContactCardPersonnel({})).toBe(false);
  });
});
