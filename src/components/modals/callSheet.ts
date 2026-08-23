/**
 * The call sheet — reach the people on the participants table.
 *
 * Everything before this made personnel *correct*; this makes them *reachable*. A referee needs the
 * physio at 9pm and a director needs the transport driver at 6am, and until now neither number was
 * anywhere in the UI even though TMX could record it.
 *
 * **D3 (CA, 2026-08-23): this surface does not respect `contact.isPublic`.** A director sees every
 * contact. Private ones carry a visible marker rather than being hidden — silently ignoring a privacy
 * flag is indefensible, and hiding a mobile from the referee at 9pm is unusable. `isPublic` continues
 * to govern PUBLIC surfaces only: the factory's `getTournamentInfo` still filters `tournamentContacts`
 * on `isPublic === true`, untouched by this work.
 *
 * The decisions live in `buildCallSheet`; this file is the shell that renders them.
 */
import { callSheetPdfRows, emailRecipients, smsRecipients, buildCallSheet, allNumbers } from './buildCallSheet';
import { isPublicContact, contactNumbers, mailtoHref, smsHref } from 'services/contact/contactLinks';
import { contactAffordances } from 'components/tables/common/formatters/contactFormatter';
import { openPDF, savePDF } from 'services/pdf/export/pdfExport';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { generateReportPDF } from 'pdf-factory';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

import type { CallSheet, CallSheetEntry, CallSheetRow, Recipients } from './buildCallSheet';

const WARNING = 'is-warning';

/**
 * Follow a `tel:` / `sms:` / `mailto:` URI.
 *
 * Through a synthesised anchor rather than `location.href =`. Assigning to `location` asks the SPA to
 * unload; browsers that do not handle the scheme leave the app in a half-navigated state, and TMX
 * holds unsaved table selection at exactly the moment this is used.
 */
function followUri(href: string): void {
  const anchor = document.createElement('a');
  anchor.rel = 'noopener';
  anchor.href = href;
  anchor.click();
}

/** Report who an action will not reach. Never let a partial send look like a complete one. */
function reportMissing(missing: CallSheetEntry[]): void {
  if (!missing.length) return;
  const names = missing.map((entry) => entry.participantName).join(', ');
  tmxToast({
    message: `${t('modals.callSheet.notReached', { count: missing.length })}: ${names}`,
    intent: WARNING,
    duration: 6000,
  });
}

/** A bulk action: follow the URI if there is one, and say who it missed either way. */
function dispatchBulk(recipients: Recipients, href: string | undefined, emptyMessage: string): void {
  if (!href) {
    tmxToast({ message: emptyMessage, intent: WARNING });
    return;
  }
  followUri(href);
  reportMissing(recipients.missing);
}

function contactLine(contact: any): HTMLElement {
  const line = document.createElement('div');
  line.className = 'tmx-call-sheet-contact';

  const whose = document.createElement('span');
  whose.className = 'tmx-call-sheet-whose';
  // `relationship` says whose number it is — SELF vs an unlabelled number are different states, which
  // is the distinction factory #4683 added the field for.
  whose.textContent = contact.name || contact.relationship || '';
  line.appendChild(whose);

  const numbers = document.createElement('span');
  numbers.className = 'tmx-call-sheet-value';
  numbers.textContent = [...contactNumbers(contact), contact.emailAddress].filter(Boolean).join(' · ');
  line.appendChild(numbers);

  for (const { href, icon, title } of contactAffordances(contact)) {
    const anchor = document.createElement('a');
    anchor.className = 'tmx-contact-link';
    anchor.title = title;
    anchor.href = href;
    anchor.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    line.appendChild(anchor);
  }

  if (!isPublicContact(contact)) {
    const mark = document.createElement('i');
    mark.className = 'fa-solid fa-lock tmx-contact-private-mark';
    mark.title = t('tables.participants.contactPrivateMark');
    line.appendChild(mark);
  }

  return line;
}

function entryBlock(entry: CallSheetEntry, muted: boolean): HTMLElement {
  const block = document.createElement('div');
  block.className = muted ? 'tmx-call-sheet-entry is-muted' : 'tmx-call-sheet-entry';

  const heading = document.createElement('div');
  heading.className = 'tmx-call-sheet-name';
  heading.textContent = entry.participantName;
  if (entry.participantRole) {
    const badge = document.createElement('span');
    badge.className = 'tmx-role-badge';
    badge.textContent = entry.participantRole;
    heading.appendChild(badge);
  }
  block.appendChild(heading);

  if (entry.contacts.length) {
    for (const contact of entry.contacts) block.appendChild(contactLine(contact));
  } else {
    const none = document.createElement('div');
    none.className = 'tmx-call-sheet-none';
    none.textContent = t('modals.callSheet.noContact');
    block.appendChild(none);
  }

  return block;
}

function sheetContent(sheet: CallSheet): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tmx-call-sheet';

  const summary = document.createElement('div');
  summary.className = 'tmx-call-sheet-summary';
  // Both halves, always. "12 reachable" alone reads as a complete roster; the second number is what
  // tells a director there is data still to collect.
  summary.textContent = `${t('modals.callSheet.reachable', { count: sheet.entries.length })} · ${t(
    'modals.callSheet.withoutContact',
    { count: sheet.unreachable.length },
  )}`;
  container.appendChild(summary);

  for (const entry of sheet.entries) container.appendChild(entryBlock(entry, false));
  for (const entry of sheet.unreachable) container.appendChild(entryBlock(entry, true));

  return container;
}

/**
 * A function rather than a module-level constant so the titles are localized at PRINT time. Evaluated
 * at import time they would resolve against whatever locale had loaded by then — and would never
 * change again when the director switches language.
 *
 * `emailAddress` carries no `width`, which is deliberate: `generateReportPDF` lets exactly one column
 * absorb the table's spare width, and an address is the value that most wants it.
 */
const pdfColumns = () => [
  { key: 'participantName', title: t('modals.callSheet.columns.name'), width: 160 },
  { key: 'participantRole', title: t('modals.callSheet.columns.role'), fitData: true },
  { key: 'whose', title: t('modals.callSheet.columns.contact'), width: 110 },
  { key: 'mobileTelephone', title: t('modals.callSheet.columns.mobile'), width: 130 },
  { key: 'telephone', title: t('modals.callSheet.columns.telephone'), width: 130 },
  { key: 'emailAddress', title: t('modals.callSheet.columns.email') },
  { key: 'isPublic', title: t('modals.callSheet.columns.public'), fitData: true },
];

function generate(sheet: CallSheet, subtitle: string, action: 'open' | 'download'): void {
  const { tournamentInfo } = tournamentEngine.getTournamentInfo() as any;
  const doc = generateReportPDF(pdfColumns(), callSheetPdfRows(sheet), {
    header: {
      tournamentName: tournamentInfo?.tournamentName || '',
      startDate: tournamentInfo?.startDate,
      endDate: tournamentInfo?.endDate,
      subtitle,
    },
  });

  if (action === 'open') openPDF({ doc });
  else savePDF({ doc, filename: 'call-sheet.pdf' });
}

function copyNumbers(sheet: CallSheet): void {
  const numbers = allNumbers(sheet);
  if (!numbers.length) {
    tmxToast({ message: t('modals.callSheet.noNumbers'), intent: WARNING });
    return;
  }
  // The escape hatch for every platform this cannot address directly — a desk phone, a radio, a
  // third-party messaging app. `clipboard` is absent over plain HTTP, so the failure is reported.
  navigator.clipboard
    ?.writeText(numbers.join('\n'))
    .then(() =>
      tmxToast({ message: t('modals.callSheet.numbersCopied', { count: numbers.length }), intent: 'is-success' }),
    )
    .catch(() => tmxToast({ message: t('modals.callSheet.copyFailed'), intent: 'is-danger' }));
}

/**
 * Open the call sheet over a set of participants table rows.
 *
 * `rows` is whatever the caller chose — the selected rows, or every row the current filters leave
 * visible. Nothing here re-derives who counts as personnel; see `buildCallSheet` for why that matters.
 */
export function callSheet({ rows, subtitle }: { rows: CallSheetRow[]; subtitle: string }): void {
  const sheet = buildCallSheet(rows);
  const sms = smsRecipients(sheet);
  const email = emailRecipients(sheet);

  const buttons = [
    { label: t('common.close'), intent: 'none', close: true },
    {
      label: `<i class="fa-solid fa-copy"></i> ${t('modals.callSheet.copyNumbers')}`,
      onClick: () => copyNumbers(sheet),
      intent: 'none',
    },
    {
      label: `<i class="fa-solid fa-print"></i> ${t('modals.callSheet.print')}`,
      onClick: () => generate(sheet, subtitle, 'open'),
      intent: 'none',
    },
    {
      label: `<i class="fa-solid fa-envelope"></i> ${t('modals.callSheet.emailAll', { count: email.values.length })}`,
      onClick: () => dispatchBulk(email, mailtoHref(email.values), t('modals.callSheet.noEmails')),
      disabled: !email.values.length,
      intent: 'is-info',
    },
    {
      label: `<i class="fa-solid fa-comment-sms"></i> ${t('modals.callSheet.textAll', { count: sms.values.length })}`,
      onClick: () => dispatchBulk(sms, smsHref(sms.values), t('modals.callSheet.noMobiles')),
      disabled: !sms.values.length,
      intent: 'is-primary',
    },
  ];

  openModal({ title: t('modals.callSheet.title'), content: sheetContent(sheet), buttons });
}
