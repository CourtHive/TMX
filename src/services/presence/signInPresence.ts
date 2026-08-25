/**
 * Was this person here **on a given day**?
 *
 * Phase (c) of TMX_PRESENCE_AND_CHECK_IN, decision **D4b — "close the day, and read as-of"**.
 *
 * **Why this cannot be `participant.signedIn`.** That field is derived by the factory's
 * `getParticipantMap` through `getTimeItem`, which returns the **latest** `SIGN_IN_STATUS` by
 * `createdAt`. Since nothing signs anybody out at the end of a day, a volunteer who signed in on
 * Thursday still reads `SIGNED_IN` on Sunday. The history is faithful; it is a history of a thing
 * whose end nobody records. Reading the history and filtering by date is what makes "here today"
 * mean what it says — and the companion half is the end-of-day action that writes the sign-out.
 *
 * **A day with no entry is `false`, and that is deliberate.** It renders as "not signed in today",
 * never as present. An inferred presence shown as a recorded one is the trap this whole surface keeps
 * naming.
 *
 * Extracted from `services/officiating/officialsBoard` (#1352) so the officials board and the
 * participants surface answer this question with one implementation rather than two — the second
 * presence model D4e exists to prevent.
 */

const SIGN_IN_STATUS = 'SIGN_IN_STATUS';
const SIGNED_IN = 'SIGNED_IN';

/**
 * The **local** calendar date of an instant — never `toISOString().slice(0, 10)`.
 *
 * `toISOString` is UTC, so west of UTC it rolls over while the tournament is still playing: at 8pm in
 * Florida it already reports tomorrow. Shipping that bug once (#1352, fixed #1355) made every official
 * read "available" every evening. Every schedule surface in TMX keys "today" on the operator's local
 * calendar date (see `gridView.todayIso`), and this must agree with them.
 *
 * ⚠️ Local is the established convention, not the ideal one — the venue's own zone would be better,
 * but moving to it is a change every schedule surface must make together.
 */
export function localCalendarDate(value?: string | Date): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Sign-in entries stamped on a given local day, oldest first. */
function entriesOn(participant: any, date: string): any[] {
  return (participant?.timeItems ?? [])
    .filter((timeItem: any) => timeItem?.itemType === SIGN_IN_STATUS && timeItem?.createdAt)
    .filter((timeItem: any) => localCalendarDate(timeItem.createdAt) === date);
}

/**
 * Whether this person's **last recorded action on that day** was signing in.
 *
 * Deliberately not "did they sign in at any point": somebody who signed in at 9am and out at 5pm was
 * not present at 6pm, and the end-of-day action depends on that distinction being honoured.
 */
export function signedInOnDate(participant: any, date: string): boolean {
  const entries = entriesOn(participant, date);
  if (!entries.length) return false;

  const latest = entries.reduce((acc: any, timeItem: any) =>
    String(timeItem.createdAt) > String(acc.createdAt) ? timeItem : acc,
  );
  return latest?.itemValue === SIGNED_IN;
}

/**
 * Everyone still signed in on this date — the set the end-of-day action closes out.
 *
 * **Role-agnostic on purpose, and this is the load-bearing difference from `signOutUnapproved`.**
 * That action is COMPETITOR-scoped precisely because "signed in with no events" is the *definition*
 * of an official, a coach or a volunteer, so without its filter it would sign out the whole personnel
 * roster. Closing the day is the opposite intent: everybody who is still marked present should stop
 * being marked present, because the day is over. The two must never be merged.
 *
 * Pure, so the decision of *who* gets signed out is testable without a DOM.
 */
export function stillSignedInOnDate(participants: any[] | undefined, date: string): string[] {
  return (participants ?? [])
    .filter((participant: any) => signedInOnDate(participant, date))
    .map((participant: any) => participant?.participantId)
    .filter(Boolean);
}
