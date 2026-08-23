/**
 * Turning a stored `Contact` into something a director can actually tap.
 *
 * A phone number that cannot be dialled from the device holding it is not a call sheet, and
 * `person.contacts[]` stores numbers as a human typed them — "+1 (555) 010-0100", "555 0100 ext 2".
 * `tel:` / `sms:` want a dial string, the table wants the original. Both are produced here so no
 * caller invents its own normalisation.
 *
 * Everything in this module is pure and DOM-free: TMX's unit suite runs in the vitest `node`
 * environment with no jsdom, so the decisions live here and the rendering stays a thin shell.
 */

export interface ContactLike {
  mobileTelephone?: string;
  emailAddress?: string;
  relationship?: string;
  telephone?: string;
  isPublic?: boolean;
  notes?: string;
  name?: string;
  fax?: string;
}

/**
 * A number reduced to what a dialler will accept: an optional leading `+` and digits.
 *
 * Returns `undefined` rather than an empty string for anything with no digits in it, so a caller
 * cannot emit a bare `tel:` href. That distinction is the whole point — `tel:` with nothing after it
 * is a link that looks live and does nothing.
 */
export function dialNumber(value?: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const digits = trimmed.replaceAll(/\D/g, '');
  if (!digits) return undefined;
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/**
 * Deliberately minimal. This is not validation — nothing here rejects a contact — it only decides
 * whether an address is worth putting behind a `mailto:`. A stricter pattern would silently drop
 * addresses a mail client would have accepted, which is the failure mode that matters on this surface.
 */
export function looksLikeEmail(value?: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  const at = trimmed.indexOf('@');
  return at > 0 && at < trimmed.length - 1 && !/\s/.test(trimmed);
}

/** The numbers on one contact, mobile first — a mobile can receive an SMS and a landline cannot. */
export function contactNumbers(contact?: ContactLike): string[] {
  return [contact?.mobileTelephone, contact?.telephone].filter((value): value is string => !!value?.trim());
}

/** The one number to ring for this contact, or `undefined`. */
export function primaryNumber(contact?: ContactLike): string | undefined {
  return contactNumbers(contact)[0];
}

/** A contact carries something a director can act on. A `name` alone is not reachable. */
export function isReachable(contact?: ContactLike): boolean {
  return !!(primaryNumber(contact) || contact?.emailAddress?.trim());
}

/**
 * Consent to publish THIS contact. `=== true` deliberately: absent and `false` both withhold.
 *
 * Mirrors `publishableContacts` in the factory's `getTournamentInfo` rather than re-deciding the rule.
 * Nothing in the ecosystem wrote this flag before factory #4680, so a truthy check would read every
 * imported contact as having consented.
 */
export function isPublicContact(contact?: ContactLike): boolean {
  return contact?.isPublic === true;
}

/** Only contacts a director can act on, in stored order (index 0 is the primary). */
export function reachableContacts(contacts?: ContactLike[]): ContactLike[] {
  return Array.isArray(contacts) ? contacts.filter(isReachable) : [];
}

export function telHref(value?: string): string | undefined {
  const dial = dialNumber(value);
  return dial ? `tel:${dial}` : undefined;
}

/**
 * `sms:` for one or many recipients, de-duplicated by dial string.
 *
 * **No `body` parameter, on purpose.** RFC 5724 gives comma-separated recipients, which iOS and
 * Android both accept — but they disagree on how a prefilled body is attached (`&body=` on iOS,
 * `?body=` on Android), so a single href cannot carry one correctly for both. A message that arrives
 * prefilled on one phone and mangled on the other is worse than an empty compose window, and the
 * director is about to type anyway. If a body is ever wanted, it needs a platform branch and a test
 * per platform, not a guess here.
 */
export function smsHref(values: (string | undefined)[]): string | undefined {
  const recipients = [...new Set(values.map(dialNumber).filter(Boolean))];
  return recipients.length ? `sms:${recipients.join(',')}` : undefined;
}

/**
 * `mailto:` addressed to everyone.
 *
 * Recipients go in **bcc** when there is more than one. A call sheet is a list of people's personal
 * addresses; putting fifteen of them in `to:` hands every recipient the other fourteen, which is a
 * disclosure the director never chose to make and cannot take back.
 */
export function mailtoHref(values: (string | undefined)[]): string | undefined {
  const recipients = [...new Set(values.filter(looksLikeEmail).map((value) => (value as string).trim()))];
  if (!recipients.length) return undefined;
  if (recipients.length === 1) return `mailto:${encodeURIComponent(recipients[0]).replaceAll('%40', '@')}`;
  return `mailto:?bcc=${recipients
    .map((r) => encodeURIComponent(r))
    .join(',')
    .replaceAll('%40', '@')}`;
}
