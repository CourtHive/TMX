/**
 * A GROUP's designated contact person — "who do I call about this group". Entirely optional.
 *
 * Stored as a POINTER to one of the group's members
 * (`extensions[{ name: 'contactPerson', value: participantId }]`) rather than by copying their details
 * onto the group. A copy would be a snapshot: rename the person or change their number and the group
 * would keep advertising the old one. The pointer resolves live.
 *
 * An extension because CODES has no contact-person field on `Participant` — verified against the types,
 * not assumed — and inventing one is a standards decision rather than a UI one. `modifyParticipant` does
 * not accept `extensions` either, which is why the UI dispatches the dedicated add/remove mutations. If
 * this earns a first-class home later, the extension migrates.
 *
 * Lives in its own module so it can be tested without importing the modal, which pulls Tabulator and
 * touches `document` at import time.
 */
export const CONTACT_PERSON_EXTENSION = 'contactPerson';

/**
 * The designated member's participantId, or `undefined`.
 *
 * Strict about membership on purpose: a pointer to someone who has since been removed from the group is
 * stale, not authoritative. Resolving it anyway would show a name the group no longer contains and offer
 * that person's number as the group's contact.
 */
export function designatedContactPersonId(group: any): string | undefined {
  const extension = (group?.extensions ?? []).find((entry: any) => entry?.name === CONTACT_PERSON_EXTENSION);
  const value = extension?.value;
  return value && (group?.individualParticipantIds ?? []).includes(value) ? value : undefined;
}
