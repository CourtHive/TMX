/**
 * Pin the `as any` workaround to the thing that causes it.
 *
 * `createParticipantsTable.ts` casts STAFF_ROLES when passing it as `participantFilters.participantRoles`,
 * because `ParticipantFilters.participantRoles` is typed `ParticipantRoleUnion[]` and that union derives
 * from `ParticipantRoleEnum` — which shipped, through 6.29.0, with 17 of the 19 roles in the
 * `participantRoles` const module. SCOREKEEPER and TIMEKEEPER are accepted at runtime and cannot be
 * *expressed* by a type-safe consumer, so tsc rejects the very list that fixes their omission.
 *
 * Fixed upstream in competition-factory#4674, released in 6.29.1.
 *
 * ── Why this keys on the PIN, not on the enum ──
 *
 * The first version of this guard read `ParticipantRoleEnum` directly, and that was wrong here. It went
 * wrong immediately: `pnpm-workspace.yaml` carries `tods-competition-factory: link:../factory`, so locally
 * the enum is whatever the sibling checkout's `dist/` was last built from — which jumped to 19 members the
 * moment an unrelated session rebuilt factory after #4674 merged, while CI still installed the published
 * 6.29.0 with 17. The result was a test red locally and green in CI: exactly backwards, and precisely the
 * "`link:` hides published factory behaviour" trap.
 *
 * The cast exists to satisfy `tsc`, and `tsc` in CI runs against the DECLARED PIN. So that is what this
 * reads. It now flips in both environments at the same moment — when the pin moves to 6.29.1 or later.
 */
import { participantRoles } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import { STAFF_ROLES } from './staffRoles';
import pkg from '../../package.json';

/** Roles that exist as runtime consts but were absent from ParticipantRoleEnum before 6.29.1. */
const DRIFTED = ['SCOREKEEPER', 'TIMEKEEPER'];

/** The release that added them to the enum, making the cast unnecessary. */
const FIXED_IN = [6, 29, 1];

const FACTORY_PIN: string = (pkg as any).dependencies?.['tods-competition-factory'] ?? '0.0.0';

/** True once the DECLARED pin — what CI installs — carries the fix. */
const pinCarriesFix = (() => {
  const pin = (FACTORY_PIN.match(/\d+/g) ?? []).slice(0, 3).map(Number);
  for (let i = 0; i < FIXED_IN.length; i++) {
    const part = pin[i] ?? 0;
    if (part !== FIXED_IN[i]) return part > FIXED_IN[i];
  }
  return true;
})();

describe('ParticipantRoleEnum drift workaround', () => {
  it('STAFF_ROLES carries the drifted roles at runtime — this is why the list is derived', () => {
    // True regardless of the pin: the const module has always carried all 19.
    for (const role of DRIFTED) expect(STAFF_ROLES).toContain(role);
    expect(Object.values(participantRoles)).toEqual(expect.arrayContaining(DRIFTED));
  });

  it('REMOVE THE `as any` when this fails: the pinned factory expresses every role', () => {
    // Asserts the CURRENT state of the pin, so it flips exactly once — when the bump lands, in CI and
    // locally together. On failure: delete `STAFF_ROLES as any` in
    // `components/tables/participantsTable/createParticipantsTable.ts` (search: `STAFF_ROLES as any`),
    // drop the explanatory comment above it, and delete this file.
    expect(
      pinCarriesFix,
      `tods-competition-factory is pinned at ${FACTORY_PIN}, which expresses SCOREKEEPER/TIMEKEEPER — ` +
        'remove the `as any` in createParticipantsTable.ts and delete src/constants/staffRoles.test.ts',
    ).toBe(false);
  });
});
