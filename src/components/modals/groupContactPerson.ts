/**
 * A GROUP's designated contact person — "who do I call about this group". Entirely optional.
 *
 * Stored as a POINTER to one of the group's members rather than by copying their details onto the
 * group. A copy would be a snapshot: rename the person or change their number and the group would keep
 * advertising the old one. The pointer resolves live.
 *
 * **Now first-class.** It began as `extensions[{ name: 'contactPerson' }]` because CODES had no field
 * for it — checked at the time, not assumed. Factory #4683 added `Participant.contactParticipantIds`,
 * which is validated against membership on write and pruned by `deleteParticipants`; the extension was
 * none of those. So this module reads BOTH and writes only the new field.
 *
 * The extension read is not legacy debt to be tidied away on sight: groups created between TMX #1324
 * and this change carry it and nothing migrates them in bulk. It can go once no record answers to it.
 *
 * Lives in its own module so it can be tested without importing the modal, which pulls Tabulator and
 * touches `document` at import time.
 */
export const CONTACT_PERSON_EXTENSION = 'contactPerson';

/**
 * Whether this group still carries the pre-#4683 extension.
 *
 * Deliberately NOT membership-checked, unlike the resolver: this answers "is there an extension to
 * remove", and an extension pointing at a non-member is exactly the kind that most needs removing.
 */
export function hasContactPersonExtension(group: any): boolean {
  return (group?.extensions ?? []).some((entry: any) => entry?.name === CONTACT_PERSON_EXTENSION);
}

/** Only ids that are actually members resolve — see `designatedContactPersonId`. */
function firstMember(candidates: string[], memberIds: string[]): string | undefined {
  return candidates.find((candidate) => candidate && memberIds.includes(candidate));
}

/**
 * The designated member's participantId, or `undefined`.
 *
 * Reads `contactParticipantIds` first and falls back to the extension, so a group written by either
 * version resolves. The factory validates the new field against membership on write; the extension was
 * never validated at all, which is why membership is re-checked here for both.
 *
 * Strict about membership on purpose: a pointer to someone since removed from the group is stale, not
 * authoritative. Resolving it anyway would show a name the group no longer contains and offer that
 * person's number as the group's contact.
 *
 * The field is an array and the UI is single-select, so the first resolvable member wins. Storing one
 * element rather than adding a second source of truth for "which one is primary".
 */
export function designatedContactPersonId(group: any): string | undefined {
  const memberIds = group?.individualParticipantIds ?? [];

  const firstClass = firstMember(group?.contactParticipantIds ?? [], memberIds);
  if (firstClass) return firstClass;

  const extension = (group?.extensions ?? []).find((entry: any) => entry?.name === CONTACT_PERSON_EXTENSION);
  return firstMember([extension?.value].filter(Boolean), memberIds);
}
