import { ContactRelationshipEnum } from 'tods-competition-factory';

/**
 * Whose number a contact is — `Contact.relationship`, added to CODES by factory #4683.
 *
 * A minor's contact is routinely a parent, a guardian or a travelling chaperone, and a Contact could
 * previously carry only a `name`. `SELF` earns its place because without it "the competitor's own
 * mobile" and "an unlabelled number" are the same state.
 *
 * Derived from the factory enum, never hand-copied. This file briefly held a literal list because CI
 * strips the `link:../factory` override and installs the PUBLISHED pin, which was 6.29.1 and had no
 * such symbol — importing it would have passed locally against the rebuilt dist and failed CI. With
 * the pin now at 6.30.0 the duplication has served its purpose and is gone. Verified in the published
 * 6.30.0 tarball, not merely through the local symlink.
 *
 * Ordered deliberately rather than alphabetically: SELF first because it is the common case, then the
 * people who answer for someone else, then the catch-alls. The enum's own member order is alphabetical
 * and would put CHAPERONE at the top of a director's dropdown.
 */
export const CONTACT_RELATIONSHIPS = [
  ContactRelationshipEnum.SELF,
  ContactRelationshipEnum.PARENT,
  ContactRelationshipEnum.GUARDIAN,
  ContactRelationshipEnum.CHAPERONE,
  ContactRelationshipEnum.EMERGENCY,
  ContactRelationshipEnum.OTHER,
] as const;

export type ContactRelationship = (typeof CONTACT_RELATIONSHIPS)[number];

/** i18n key for a relationship value; the values double as the key suffixes. */
export function relationshipKey(relationship: string): string {
  return `pages.participants.contactRelationship.${relationship.toLowerCase()}`;
}
