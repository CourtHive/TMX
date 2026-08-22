/**
 * Whose number a contact is — `Contact.relationship`, added to CODES by factory #4683.
 *
 * A minor's contact is routinely a parent, a guardian or a travelling chaperone, and a Contact could
 * previously carry only a `name`. `SELF` earns its place because without it "the competitor's own
 * mobile" and "an unlabelled number" are the same state.
 *
 * ## Why this is a local list and not `ContactRelationshipEnum` from the factory
 *
 * TMX CI strips the `link:../factory` override and installs the PUBLISHED pin (`ci.yml` — "Strip link:
 * overrides for CI"), currently 6.29.1. `ContactRelationshipEnum` does not exist there, so importing it
 * would fail the type-check gate and throw at runtime in CI while passing locally against the rebuilt
 * dist — the exact class of divergence that `link:` overrides hide.
 *
 * This is therefore a DELIBERATE, TEMPORARY duplication with a defined end: once the factory publishes
 * and TMX's pin is bumped, replace the array below with
 *
 *     const { ContactRelationshipEnum } = require('tods-competition-factory');
 *
 * and delete this comment. Tracked in `Mentat/TASKS.md` under "TMX: adopt the CODES contact model".
 * A hand-copied vocabulary that outlives its reason is how SCOREKEEPER and TIMEKEEPER stayed missing
 * from the Staff view for months — this one is scheduled to die.
 */
export const CONTACT_RELATIONSHIPS = ['SELF', 'PARENT', 'GUARDIAN', 'CHAPERONE', 'EMERGENCY', 'OTHER'] as const;

export type ContactRelationship = (typeof CONTACT_RELATIONSHIPS)[number];

/** i18n key for a relationship value; the values double as the key suffixes. */
export function relationshipKey(relationship: string): string {
  return `pages.participants.contactRelationship.${relationship.toLowerCase()}`;
}
