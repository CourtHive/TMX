/**
 * A GROUP's designated contact person is a POINTER to a member, not a copy of their details. A copy is a
 * snapshot: rename the person or change their number and the group keeps advertising the old one.
 *
 * The resolver is deliberately strict about membership — a pointer to someone who has since been removed
 * is stale, not authoritative.
 */
import { CONTACT_PERSON_EXTENSION, designatedContactPersonId, hasContactPersonExtension } from './groupContactPerson';
import { describe, expect, it } from 'vitest';

const group = (extensions: any, individualParticipantIds: string[] = ['p1', 'p2']) => ({
  participantId: 'g1',
  individualParticipantIds,
  extensions,
});

describe('designatedContactPersonId', () => {
  it('resolves a pointer to a current member', () => {
    expect(designatedContactPersonId(group([{ name: CONTACT_PERSON_EXTENSION, value: 'p2' }]))).toEqual('p2');
  });

  it('ignores a pointer to someone who is no longer a member', () => {
    // The stale case. Resolving it would show a name the group does not contain and offer that person's
    // number as the group's contact.
    expect(designatedContactPersonId(group([{ name: CONTACT_PERSON_EXTENSION, value: 'p9' }]))).toBeUndefined();
  });

  it('returns undefined when no designation exists', () => {
    expect(designatedContactPersonId(group([]))).toBeUndefined();
    expect(designatedContactPersonId(group(undefined))).toBeUndefined();
    expect(designatedContactPersonId({} as any)).toBeUndefined();
  });

  it('ignores unrelated extensions', () => {
    // Groups can carry other extensions; only this one designates a contact.
    expect(designatedContactPersonId(group([{ name: 'somethingElse', value: 'p1' }]))).toBeUndefined();
  });

  it('ignores an empty pointer value', () => {
    expect(designatedContactPersonId(group([{ name: CONTACT_PERSON_EXTENSION, value: '' }]))).toBeUndefined();
  });
});

describe('designatedContactPersonId — contactParticipantIds (factory #4683)', () => {
  const withField = (contactParticipantIds: any, extensions: any = [], members = ['p1', 'p2']) => ({
    participantId: 'g1',
    individualParticipantIds: members,
    contactParticipantIds,
    extensions,
  });

  it('resolves the first-class field', () => {
    expect(designatedContactPersonId(withField(['p2']))).toEqual('p2');
  });

  it('PREFERS the first-class field over a disagreeing extension', () => {
    // Both can be present on a group edited before and after the migration. The field the factory
    // validates on write wins over the one it never validated.
    const both = withField(['p2'], [{ name: CONTACT_PERSON_EXTENSION, value: 'p1' }]);
    expect(designatedContactPersonId(both)).toEqual('p2');
  });

  it('FALLS BACK to the extension for a group written before the migration', () => {
    // The reason the extension read is not deleted: nothing migrates these records in bulk, so a group
    // created between TMX #1324 and this change resolves only through the fallback.
    expect(designatedContactPersonId(withField(undefined, [{ name: CONTACT_PERSON_EXTENSION, value: 'p1' }]))).toEqual(
      'p1',
    );
  });

  it('falls back when the first-class field is present but points at a non-member', () => {
    const stale = withField(['p9'], [{ name: CONTACT_PERSON_EXTENSION, value: 'p1' }]);
    expect(designatedContactPersonId(stale)).toEqual('p1');
  });

  it('treats an empty array as "no designation" rather than as an error', () => {
    expect(designatedContactPersonId(withField([]))).toBeUndefined();
  });

  it('takes the first RESOLVABLE member, not merely the first entry', () => {
    // The field is plural and the UI is single-select. A non-member in position 0 must not mask a
    // valid designation behind it.
    expect(designatedContactPersonId(withField(['p9', 'p2']))).toEqual('p2');
  });
});

describe('hasContactPersonExtension', () => {
  it('reports an extension that the resolver would REJECT', () => {
    // Deliberately not membership-checked. This answers "is there an extension to remove", and a
    // pointer to a non-member is exactly the kind that most needs removing — if it were skipped, a
    // later re-add of that member would resurrect a designation nobody asked for.
    const stale = group([{ name: CONTACT_PERSON_EXTENSION, value: 'p9' }]);
    expect(designatedContactPersonId(stale)).toBeUndefined();
    expect(hasContactPersonExtension(stale)).toBe(true);
  });

  it('is false when no such extension exists', () => {
    expect(hasContactPersonExtension(group([]))).toBe(false);
    expect(hasContactPersonExtension(group([{ name: 'somethingElse', value: 'p1' }]))).toBe(false);
    expect(hasContactPersonExtension({} as any)).toBe(false);
  });
});
