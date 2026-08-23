import { CONTACT_RELATIONSHIPS, relationshipKey } from 'constants/contactRelationships';
import { ContactRelationshipEnum } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

/**
 * This list was briefly hand-written, because CI installs the PUBLISHED factory pin and 6.29.1 had no
 * `ContactRelationshipEnum`. Now that the pin is 6.30.0 it is derived — and this file is the guard
 * that a literal list could never provide.
 */

describe('CONTACT_RELATIONSHIPS is derived from the factory enum', () => {
  it('covers every member the factory defines', () => {
    // If CODES gains a relationship, this fails rather than silently offering a director an
    // incomplete dropdown. A hand-copied list drifts in exactly this way — it is how SCOREKEEPER and
    // TIMEKEEPER stayed missing from the Staff view for months.
    expect([...CONTACT_RELATIONSHIPS].sort()).toEqual(Object.values(ContactRelationshipEnum).sort());
  });

  it('leads with SELF rather than the enum ordering', () => {
    // The enum is alphabetical, which would put CHAPERONE at the top of the dropdown. Ordering here is
    // a UI decision: the common case first, then people answering for someone else, then catch-alls.
    expect(CONTACT_RELATIONSHIPS[0]).toEqual(ContactRelationshipEnum.SELF);
  });

  it('maps each value to a lowercase i18n key', () => {
    expect(relationshipKey(ContactRelationshipEnum.GUARDIAN)).toEqual(
      'pages.participants.contactRelationship.guardian',
    );
  });
});
