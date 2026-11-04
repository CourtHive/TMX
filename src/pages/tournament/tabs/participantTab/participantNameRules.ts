/**
 * Whether the individual participant editor may save these names.
 *
 * The factory refuses a `standardGivenName` or `standardFamilyName` shorter than two characters instead of
 * dropping it, so the form must not send one: a refused save leaves the drawer closed and only a toast to say
 * why. A nickname alone is still enough to save, but a name that IS entered must be at least two characters,
 * even beside a nickname.
 *
 * A name equal to the stored one is always accepted, because the factory never refuses an unchanged value: a
 * legacy one-letter name must not block an edit to the participant's other fields.
 */
export const MIN_NAME_LENGTH = 2;

type NameValues = { firstName?: string; lastName?: string; nickname?: string };

const normalized = (value: unknown): string =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

export function nameIsAcceptable(value: unknown, storedValue?: unknown): boolean {
  const name = normalized(value);
  if (name === normalized(storedValue)) return true;
  return !name.length || name.length >= MIN_NAME_LENGTH;
}

export function participantNamesValid(values: NameValues, stored: NameValues = {}): boolean {
  if (!nameIsAcceptable(values.firstName, stored.firstName)) return false;
  if (!nameIsAcceptable(values.lastName, stored.lastName)) return false;

  // both names present, each already known to be acceptable
  const hasFullName = !!normalized(values.firstName) && !!normalized(values.lastName);
  const hasNickname = normalized(values.nickname).length >= MIN_NAME_LENGTH;
  return hasFullName || hasNickname;
}
