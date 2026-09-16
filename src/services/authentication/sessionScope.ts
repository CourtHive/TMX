import { getUserContext } from 'services/authentication/getUserContext';
import { context } from 'services/context';

/**
 * Who this session is, and which provider it is looking at.
 *
 * Long reads issue a request under one identity and resolve under whatever
 * identity exists when the promise settles — the two are not the same thing.
 * On 2026-09-15 a super-admin stopped impersonating (which re-requests the
 * calendar) and then logged out; the calendar resolved after the logout and
 * painted 49,000+ provider tournaments into a logged-out browser. Nothing
 * checked that the session that got the answer was the one that asked.
 *
 * Capture the scope before an await, compare after, and drop the response if it
 * moved. Both halves matter:
 *   - `userId` catches logout and user switching;
 *   - `providerAbbr` catches starting, stopping, or changing impersonation,
 *     which changes what the caller was asking *for*.
 */
export function currentSessionScope(): string {
  const userId = getUserContext()?.userId ?? '';
  const providerAbbr = context?.provider?.organisationAbbreviation ?? '';
  return `${userId}|${providerAbbr}`;
}

/** True when the session still matches the scope captured before the await. */
export function sessionScopeUnchanged(capturedScope: string): boolean {
  return currentSessionScope() === capturedScope;
}
