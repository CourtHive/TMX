/**
 * The call sheet's data layer — who is on it, how to reach them, and who cannot be reached.
 *
 * Pure and DOM-free, because TMX's unit suite runs in the vitest `node` environment with no jsdom.
 * Every decision the call sheet makes lives here so it can be tested; `callSheet.ts` is the shell.
 *
 * **The population is the table's own rows**, passed in by the caller. Nothing here re-derives which
 * participants count as personnel. The participants table is already role-filtered per view, and the
 * factory's `STAFF_CONTACT_ROLES` — the list that decides who appears in `tournamentContacts` — is a
 * module-local const in `getTournamentInfo`, not exported. Copying it would make a fifth hand-written
 * role array in this codebase, which is exactly the drift that hid SCOREKEEPER and TIMEKEEPER from
 * the Staff view for months. It would also be the WRONG list: it deliberately excludes COACH,
 * CAPTAIN and VOLUNTEER because publishing them would turn the tournament's public contact list into
 * a roster — and those are precisely the people a director needs to ring at 6am.
 */
import { isPublicContact, reachableContacts, primaryNumber } from 'services/contact/contactLinks';

import type { ContactLike } from 'services/contact/contactLinks';

export interface CallSheetRow {
  individualParticipantIds?: string[];
  participantName?: string;
  participantRole?: string;
  participantType?: string;
  participantId?: string;
  contacts?: ContactLike[];
}

export interface CallSheetEntry {
  contacts: ContactLike[];
  participantName: string;
  participantRole?: string;
  participantId?: string;
}

export interface CallSheet {
  /** People carrying at least one contact a director can act on, in the order the table showed them. */
  entries: CallSheetEntry[];
  /** People on the sheet with no reachable contact at all. Reported, never silently dropped. */
  unreachable: CallSheetEntry[];
}

/** A bulk action's recipients, plus the people it will NOT reach. */
export interface Recipients {
  missing: CallSheetEntry[];
  values: string[];
}

const entryFrom = (row: CallSheetRow): CallSheetEntry => ({
  participantName: row.participantName?.trim() || '',
  participantRole: row.participantRole,
  participantId: row.participantId,
  contacts: reachableContacts(row.contacts),
});

/**
 * Build the sheet from table rows.
 *
 * Row order is preserved rather than re-sorted: the director sorted the table, and a printed sheet
 * that disagrees with the screen it was printed from is a sheet nobody trusts.
 */
export function buildCallSheet(rows: CallSheetRow[]): CallSheet {
  const entries: CallSheetEntry[] = [];
  const unreachable: CallSheetEntry[] = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    // A GROUP or TEAM row has no `person` and therefore no contacts of its own. It is not a mistake
    // for one to appear — `contactParticipantIds` names a group's contact PERSON, who is an
    // INDIVIDUAL already on the sheet in their own right — so it is skipped rather than reported.
    if (row.participantType && row.participantType !== 'INDIVIDUAL') continue;
    const entry = entryFrom(row);
    if (!entry.participantName) continue;
    if (entry.contacts.length) entries.push(entry);
    else unreachable.push(entry);
  }

  return { entries, unreachable };
}

/**
 * One mobile per person — the first contact of theirs that has one.
 *
 * Not every contact they hold. A competitor with a guardian, a chaperone and their own mobile would
 * otherwise receive three copies of "courts are wet, play delayed 30 minutes", which is how a useful
 * feature teaches people to ignore it. The per-row affordances and the sheet's own per-contact links
 * are how a director reaches one specific number.
 */
export function smsRecipients(sheet: CallSheet): Recipients {
  const values: string[] = [];
  const missing: CallSheetEntry[] = [];

  for (const entry of sheet.entries) {
    const mobile = entry.contacts.map((contact) => contact.mobileTelephone).find((value) => !!value?.trim());
    if (mobile) values.push(mobile);
    else missing.push(entry);
  }

  // The people the sheet already knows are unreachable are missing from every action, not just this
  // one. Reporting them here keeps "who will not get this message" a single, complete answer.
  return { values, missing: [...missing, ...sheet.unreachable] };
}

/** One address per person, same rule as {@link smsRecipients}. */
export function emailRecipients(sheet: CallSheet): Recipients {
  const values: string[] = [];
  const missing: CallSheetEntry[] = [];

  for (const entry of sheet.entries) {
    const email = entry.contacts.map((contact) => contact.emailAddress).find((value) => !!value?.trim());
    if (email) values.push(email);
    else missing.push(entry);
  }

  return { values, missing: [...missing, ...sheet.unreachable] };
}

/** Every number on the sheet, for the clipboard fallback. */
export function allNumbers(sheet: CallSheet): string[] {
  return sheet.entries.flatMap((entry) =>
    entry.contacts.map(primaryNumber).filter((value): value is string => !!value),
  );
}

/**
 * Rows for the printed sheet — one per PERSON, with their contacts stacked inside the cells.
 *
 * One row per contact would have been easier and reads worse: a director scanning for a name would
 * find it two or three times, and the columns that repeat (name, role) carry no information on the
 * second appearance. `jspdf-autotable` renders `\n` as a line break, so the stacked cells stay
 * aligned with each other — the third line of the Mobile column belongs to the third line of the
 * Contact column.
 *
 * `unreachable` people are included, with empty contact cells. A call sheet that silently omits the
 * volunteer whose number nobody collected is a call sheet that says the roster is complete.
 */
export function callSheetPdfRows(sheet: CallSheet): Record<string, string>[] {
  const stack = (values: (string | undefined)[]) => values.map((value) => value?.trim() || '—').join('\n');

  const toRow = (entry: CallSheetEntry): Record<string, string> => ({
    participantName: entry.participantName,
    participantRole: entry.participantRole ?? '',
    whose: stack(entry.contacts.map((contact) => contact.name || contact.relationship)),
    mobileTelephone: stack(entry.contacts.map((contact) => contact.mobileTelephone)),
    telephone: stack(entry.contacts.map((contact) => contact.telephone)),
    emailAddress: stack(entry.contacts.map((contact) => contact.emailAddress)),
    // D3 in print. A director holding the sheet needs to know which of these numbers the person
    // agreed could be shared, because the sheet itself leaves the room.
    isPublic: stack(entry.contacts.map((contact) => (isPublicContact(contact) ? 'Y' : 'N'))),
  });

  return [...sheet.entries.map(toRow), ...sheet.unreachable.map(toRow)];
}
