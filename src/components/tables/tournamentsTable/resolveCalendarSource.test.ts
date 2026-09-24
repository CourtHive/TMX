import { describe, expect, it } from 'vitest';

import { resolveCalendarSource } from './calendarSource';

/**
 * WHICH feed the tournaments list reads, and why the authenticated case is the one that matters.
 *
 * The public provider calendar is PUBLISHED ONLY. Handing it to a logged-in director does not look
 * like a permissions quirk — it looks like their tournaments were deleted. That is what happened on
 * every cold load of this page: the branch asked `getUserContext()`, a synchronous read of a cache
 * that only `/auth/me` fills, and `fetchUserContext()` is fire-and-forget at boot. So on a refresh
 * the value was undefined, the page took the logged-out branch, and a director's unpublished
 * tournaments disappeared until they navigated in-app — at which point the cache had filled and the
 * list silently started working again. Reproduced 2026-09-24: cold load issued `provider/calendar`
 * and never `provider/my-calendars`.
 *
 * These tests pin the RULE. The call site passing `!!getLoginState()` — synchronous, JWT-validated,
 * no network — is covered by journey 130, because TMX's CI runs no web e2e.
 */

describe('resolveCalendarSource', () => {
  it('gives a logged-in caller the OPERATOR feed, which includes unpublished tournaments', () => {
    expect(resolveCalendarSource({ authenticated: true, providerAbbr: 'TMX' })).toBe('my-calendars');
  });

  it('still gives a logged-in caller the operator feed with NO provider in scope', () => {
    // A super-admin who has not picked a provider is still logged in. The server decides what that
    // resolves to (an unscoped super-admin gets an empty list by design); the client must not
    // silently downgrade them to the published-only feed.
    expect(resolveCalendarSource({ authenticated: true, providerAbbr: undefined })).toBe('my-calendars');
  });

  it('gives a logged-OUT visitor with a provider in scope the public feed', () => {
    expect(resolveCalendarSource({ authenticated: false, providerAbbr: 'TMX' })).toBe('public');
  });

  it('falls back to local storage only when there is neither a session nor a provider', () => {
    expect(resolveCalendarSource({ authenticated: false, providerAbbr: undefined })).toBe('local');
  });

  it('treats an empty provider abbreviation as no provider', () => {
    expect(resolveCalendarSource({ authenticated: false, providerAbbr: '' })).toBe('local');
  });

  it('never routes an authenticated caller to the published-only feed, whatever the provider', () => {
    // The regression in one line: authentication decides the feed, and nothing else may override it.
    for (const providerAbbr of [undefined, '', 'TMX', 'BOBOCA']) {
      expect(resolveCalendarSource({ authenticated: true, providerAbbr })).not.toBe('public');
    }
  });
});
