/**
 * Pin the `as any` workaround to the thing that causes it.
 *
 * `createParticipantsTable.ts` casts STAFF_ROLES when passing it as `participantFilters.participantRoles`,
 * because `ParticipantFilters.participantRoles` is typed `ParticipantRoleUnion[]` and that union derives
 * from `ParticipantRoleEnum` — which ships (as of factory 6.29.0) with 17 of the 19 roles in the
 * `participantRoles` const module. SCOREKEEPER and TIMEKEEPER are accepted at runtime and cannot be
 * *expressed* by a type-safe consumer, so tsc rejects the very list that fixes their omission.
 *
 * Fixed upstream in competition-factory#4674. The cast must be removed when TMX bumps to a factory that
 * carries the fix — and a comment is a poor way to remember that, so this asserts the limitation instead.
 * The moment the bump lands, this test fails and names the file to edit.
 */
import { ParticipantRoleEnum, participantRoles } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import { STAFF_ROLES } from './staffRoles';

// The two roles that exist as runtime consts but (pre-fix) not as enum members.
const DRIFTED = ['SCOREKEEPER', 'TIMEKEEPER'];

describe('ParticipantRoleEnum drift workaround', () => {
  it('STAFF_ROLES carries the drifted roles at runtime — this is why the list is derived', () => {
    for (const role of DRIFTED) expect(STAFF_ROLES).toContain(role);
    expect(Object.values(participantRoles)).toEqual(expect.arrayContaining(DRIFTED));
  });

  it('REMOVE THE `as any` when this fails: the enum has caught up with the const module', () => {
    const enumMembers = Object.values(ParticipantRoleEnum) as string[];
    const stillMissing = DRIFTED.filter((role) => !enumMembers.includes(role));

    // Deliberately asserts the CURRENT limitation, not the desired end state. When the factory bump lands,
    // `stillMissing` becomes [] and this fails — which is the signal to delete the cast at
    // `components/tables/participantsTable/createParticipantsTable.ts` (search: `STAFF_ROLES as any`),
    // drop the explanatory comment above it, and delete this file.
    expect(
      stillMissing,
      'ParticipantRoleEnum now expresses SCOREKEEPER/TIMEKEEPER — remove the `as any` in ' +
        'createParticipantsTable.ts and delete src/constants/staffRoles.test.ts',
    ).toEqual(DRIFTED);
  });
});
