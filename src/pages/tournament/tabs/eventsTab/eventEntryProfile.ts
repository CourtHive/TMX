// Pure logic for the event drawer's Entries section: the event's entryProfile sizes as form values, and the
// form read back into the `entryProfile` update modifyEvent merges. No UI imports, so it is tested through the
// real engine. The checks mirror the factory's validation so a save it would refuse is refused here, before
// anything is sent.
import { MODIFY_EVENT } from 'constants/mutationConstants';

/** The sizes the drawer edits, in display order. */
export const ENTRY_PROFILE_FIELDS = [
  'entriesLimit',
  'targetDrawSize',
  'qualifiersCount',
  'qualifyingDrawSize',
  'wildcardCount',
] as const;
export type EntryProfileField = (typeof ENTRY_PROFILE_FIELDS)[number];

// qualifiers and wildcards may be 0; the sizes may not
const ZERO_ALLOWED = new Set<EntryProfileField>(['qualifiersCount', 'wildcardCount']);
// stated by the multi-structure `qualifyingProfiles` when the event has them, so not edited here
const SIMPLE_QUALIFYING = new Set<EntryProfileField>(['qualifiersCount', 'qualifyingDrawSize']);

export type EntryProfileRefusal =
  'NOT_A_WHOLE_NUMBER' | 'QUALIFIERS_NOT_FEWER_THAN_QUALIFYING_DRAW' | 'RESERVED_PLACES_EXCEED_DRAW';

/** An event stating multi-structure qualifying keeps it; the drawer edits only the simple qualifying sizes. */
export function hasQualifyingProfiles(event: any): boolean {
  return !!event?.entryProfile?.qualifyingProfiles?.length;
}

/** The fields the drawer shows for an event. */
export function entryProfileFields(event: any): EntryProfileField[] {
  return hasQualifyingProfiles(event)
    ? ENTRY_PROFILE_FIELDS.filter((field) => !SIMPLE_QUALIFYING.has(field))
    : [...ENTRY_PROFILE_FIELDS];
}

/** The event's sizes as form values; '' where the profile states none. */
export function entryProfileFormValues(event: any): Record<EntryProfileField, string> {
  const profile = event?.entryProfile ?? {};
  return Object.fromEntries(
    ENTRY_PROFILE_FIELDS.map((field) => [field, Number.isSafeInteger(profile[field]) ? String(profile[field]) : '']),
  ) as Record<EntryProfileField, string>;
}

/**
 * The form read back into an `entryProfile` update: only the keys that changed, a cleared field as null (which
 * modifyEvent reads as "remove"). No update when nothing changed. A refusal names what the factory would refuse.
 */
export function readEntryProfileForm({
  form,
  event,
}: {
  form: Partial<Record<EntryProfileField, unknown>>;
  event?: any;
}): { entryProfile?: Record<string, number | null>; refusal?: EntryProfileRefusal; field?: EntryProfileField } {
  const previous = event?.entryProfile ?? {};
  const next: Record<string, number | undefined> = {};
  const update: Record<string, number | null> = {};

  for (const field of entryProfileFields(event)) {
    // a field the form does not carry is left as stored
    if (!(field in form)) continue;
    const raw = typeof form[field] === 'string' ? (form[field] as string).trim() : form[field];
    if (raw === undefined || raw === null || raw === '') {
      next[field] = undefined;
    } else {
      const value = Number(raw);
      const valid = Number.isSafeInteger(value) && (value > 0 || (value === 0 && ZERO_ALLOWED.has(field)));
      if (!valid) return { refusal: 'NOT_A_WHOLE_NUMBER', field };
      next[field] = value;
    }
    if (next[field] !== previous[field]) update[field] = next[field] ?? null;
  }

  // a cleared field is undefined in `next`, so it clears the previous value here too
  const { targetDrawSize, qualifyingDrawSize, qualifiersCount, wildcardCount = 0 } = { ...previous, ...next };
  if (qualifyingDrawSize && qualifiersCount && qualifiersCount >= qualifyingDrawSize)
    return { refusal: 'QUALIFIERS_NOT_FEWER_THAN_QUALIFYING_DRAW', field: 'qualifiersCount' };

  // with qualifyingProfiles the qualifier places are the factory's to count; it still refuses an overflow
  const reservedQualifiers = hasQualifyingProfiles(event) ? 0 : (qualifiersCount ?? 0);
  if (targetDrawSize && reservedQualifiers + wildcardCount > targetDrawSize)
    return { refusal: 'RESERVED_PLACES_EXCEED_DRAW', field: 'targetDrawSize' };

  return Object.keys(update).length ? { entryProfile: update } : {};
}

/** The modifyEvent method carrying an entryProfile update, for a new or an existing event. */
export function buildEntryProfileMethod({
  entryProfile,
  eventId,
}: {
  entryProfile?: Record<string, number | null>;
  eventId: string;
}) {
  if (!entryProfile) return undefined;
  return { method: MODIFY_EVENT, params: { eventId, eventUpdates: { entryProfile } } };
}
