import { getToken } from 'services/authentication/tokenManagement';
import { context } from 'services/context';
import { jwtDecode } from 'jwt-decode';

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
 *   - the token identity catches logout and user switching;
 *   - `providerAbbr` catches starting, stopping, or changing impersonation,
 *     which changes what the caller was asking *for*.
 */

/**
 * The identity carried by the access token, or '' when there is no token.
 *
 * Read from the TOKEN, not from `getUserContext()`. The user context is a cache
 * that only `/auth/me` fills, and `fetchUserContext()` is fire-and-forget at
 * login and at boot, which made this guard wrong in both directions:
 *   - never filled (a cold load, journey 124) → `userId` was '' before AND
 *     after the logout, the scope string did not move, and the guard waved the
 *     stale response through — the exact incident it exists to prevent, failing
 *     open on the path where it matters most;
 *   - filled *during* the read → the scope moved on its own and a legitimate
 *     response was discarded.
 * The token is synchronous, needs no network, and is removed by `logOut()`, so
 * it answers "is this still the session that asked" without racing anything.
 * `createTournamentsTable` reached the same conclusion about the same cache in
 * #1493; this applies it to the guard that read it.
 *
 * Claim precedence is a union because the issuers differ: CFS access tokens
 * carry `email` (some flows also `userId`); e2e's synthetic super-admin token
 * carries only `sub`. Any of them identifies WHO asked. A token whose claims we
 * do not recognise still reads as a session, because what logout must change is
 * that a token is present at all.
 */
function tokenIdentity(): string {
  const token = getToken();
  if (!token) return '';
  try {
    const claims = jwtDecode<{ userId?: string; email?: string; sub?: string }>(token);
    return claims.userId ?? claims.email ?? claims.sub ?? 'authenticated';
  } catch {
    // Deliberately no `removeToken()` here: a scope read must have no side
    // effects, or comparing the scope would change it.
    return 'authenticated';
  }
}

export function currentSessionScope(): string {
  const providerAbbr = context?.provider?.organisationAbbreviation ?? '';
  return `${tokenIdentity()}|${providerAbbr}`;
}

/** True when the session still matches the scope captured before the await. */
export function sessionScopeUnchanged(capturedScope: string): boolean {
  return currentSessionScope() === capturedScope;
}
