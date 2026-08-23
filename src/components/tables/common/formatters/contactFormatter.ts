/**
 * The tappable half of the call sheet: `tel:` / `sms:` / `mailto:` affordances on a participant row.
 *
 * Renders the participant's PRIMARY contact only. A row is one line high and a person can hold
 * several contacts; stacking them would make the personnel views unreadable for the case that matters
 * least. The full list — every contact, with its relationship and its consent state — is what the call
 * sheet modal is for, and the `+n` marker here is the affordance that says it exists.
 *
 * **D3 (CA, 2026-08-23): the TD surface does not respect `contact.isPublic`.** A director sees every
 * number, and a contact without consent carries a visible marker rather than being hidden. Silently
 * dropping a number the director needs at 9pm would be unusable; showing it without saying it is
 * private would be indefensible. `isPublic` continues to govern public surfaces only — the factory's
 * `getTournamentInfo` still filters `tournamentContacts` on `isPublic === true`, untouched.
 */
import {
  isPublicContact,
  primaryNumber,
  looksLikeEmail,
  mailtoHref,
  telHref,
  smsHref,
} from 'services/contact/contactLinks';
import { t } from 'i18n';

import type { ContactLike } from 'services/contact/contactLinks';

/** One rendered affordance: an href plus the icon and tooltip that describe it. */
export interface ContactAffordance {
  title: string;
  href: string;
  icon: string;
}

/**
 * The affordances a single contact supports, in the order a director reaches for them: text first
 * (least intrusive, and the "text these six" action's unit), then call, then email.
 *
 * `sms:` is offered only for a MOBILE. Texting a landline silently does nothing on every platform,
 * and an affordance that looks live and is not is the failure this module exists to avoid.
 */
export function contactAffordances(contact?: ContactLike): ContactAffordance[] {
  const affordances: ContactAffordance[] = [];

  const sms = smsHref([contact?.mobileTelephone]);
  if (sms) affordances.push({ href: sms, icon: 'fa-comment-sms', title: t('tables.participants.contactText') });

  const tel = telHref(primaryNumber(contact));
  if (tel) affordances.push({ href: tel, icon: 'fa-phone', title: t('tables.participants.contactCall') });

  const mail = looksLikeEmail(contact?.emailAddress) ? mailtoHref([contact?.emailAddress]) : undefined;
  if (mail) affordances.push({ href: mail, icon: 'fa-envelope', title: t('tables.participants.contactEmail') });

  return affordances;
}

/**
 * The cell's markup for a participant's contact list.
 *
 * `stopPropagation` on the anchor matters: the row's own click handlers select the row, and a
 * director tapping a phone number on a tablet would otherwise toggle the selection they are about to
 * act on.
 */
export function contactCellMarkup(contacts?: ContactLike[]): string {
  const list = Array.isArray(contacts) ? contacts : [];
  const primary = list[0];
  const affordances = contactAffordances(primary);
  if (!affordances.length) return '';

  const links = affordances
    .map(
      ({ href, icon, title }) =>
        `<a class="tmx-contact-link" href="${href}" title="${title}" onclick="event.stopPropagation()"><i class="fa-solid ${icon}"></i></a>`,
    )
    .join('');

  // The private marker (D3) and the "there are more" marker are separate facts and read separately.
  const privacy = isPublicContact(primary)
    ? ''
    : `<i class="fa-solid fa-lock tmx-contact-private-mark" title="${t('tables.participants.contactPrivateMark')}"></i>`;
  const extra =
    list.length > 1
      ? `<span class="tmx-contact-more" title="${t('tables.participants.contactMore')}">+${list.length - 1}</span>`
      : '';

  return `<span class="tmx-contact-cell">${links}${privacy}${extra}</span>`;
}

/** Tabulator cell formatter over the row's `contacts` array. */
export function contactFormatter(cell: any): string {
  return contactCellMarkup(cell.getValue());
}
