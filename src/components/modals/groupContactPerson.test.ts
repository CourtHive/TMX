/**
 * A GROUP's designated contact person is a POINTER to a member, not a copy of their details. A copy is a
 * snapshot: rename the person or change their number and the group keeps advertising the old one.
 *
 * The resolver is deliberately strict about membership — a pointer to someone who has since been removed
 * is stale, not authoritative.
 */
import { CONTACT_PERSON_EXTENSION, designatedContactPersonId } from './groupContactPerson';
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
