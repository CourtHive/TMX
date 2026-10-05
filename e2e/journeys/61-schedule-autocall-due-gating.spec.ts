import { test, expect, type Page } from '@playwright/test';
import { createMutationCollector } from '../helpers/mutation-collector';
import { todayLocal } from '../helpers/dates';
import { TournamentPage } from '../pages/TournamentPage';
import {
  initDevBridge,
  isolateFromCfs,
  loginAsProviderMember,
  resetState,
  waitForAppReady,
} from '../helpers/dev-bridge';

/**
 * Journey 61 — Now-strip auto-call due-gating.
 *
 * When a court has no live/called match, its next pending match is auto-called
 * (setMatchUpCalledAt) on strip render — UNLESS its scheduledTime is strictly in
 * the future (computeAutoCalls, autoCallDueMatches.ts). runAutoCallPass fires on
 * the strip refresh (gridView.ts:2241, today-gated), so the decision is
 * observable at mount via the mutation collector. A regression here silently
 * calls matches to court at the wrong time — a participant-notification hazard.
 *
 * Auto-call is provider-member-gated (isTournamentProviderMember): it only fires
 * for a user associated with the tournament's provider, so this journey seeds
 * `parentOrganisation` on the record (synced into engine state so the load-time
 * short-circuit doesn't serve a parent-less in-memory copy) and logs in as a
 * provider member via `loginAsProviderMember`. Without that, the auth gate — not
 * the due-gate under test — would suppress the call and the second case would
 * pass for the wrong reason.
 *
 * Two things outside the app used to decide this journey, and both are now pinned:
 *
 * - **A running CFS.** The provider-member token is unsigned. The auto-call goes
 *   through `mutationRequest` → `checkPermissions` → `ensureUserContext()`, which
 *   fires `GET /auth/me`; a real CFS on :8383 answers 401, and with no refresh token
 *   `baseApi` calls `logOut()` and routes to `#/tournaments/logout`. Every run
 *   against a live CFS logged out — it passed only when `waitForSelector` saw the
 *   strip before the 401 landed (~100ms), and failed when it did not (seen
 *   2026-10-04). `isolateFromCfs` aborts those requests, so the token stays and the
 *   permission check falls back to the JWT, as it does with no server at all.
 * - **The wall clock.** The second case's `23:59` is strictly future for all but the
 *   last minute of the day, when the match is due and IS called. The browser clock
 *   is pinned to local noon on the seeded day, so "future" is a fact of the fixture.
 */

/** Local noon — every `HH:MM` the cases use sits unambiguously before or after it. */
const PINNED_TIME = '12:00:00';
const STRIP = '.spl-active-strip';
const PROVIDER_ID = 'e2e-provider-1';

/** Server-first would emit to a socket that never acks in the client-only e2e run;
 *  keep the auto-call mutation local so it applies + logs deterministically. Set
 *  after the full-page goto (fresh module state) and before the scheduling strip
 *  mounts — navigateToScheduling is an in-SPA hash route, so this persists. */
async function forceLocalExecution(page: Page): Promise<void> {
  await page.evaluate(() => {
    dev.env.serverFirst = false;
  });
}

/** Seed a single-court venue and schedule one pending R1 matchUp on today with the given time. */
async function seedOnePlaced(
  page: Page,
  date: string,
  scheduledTime?: string,
): Promise<{ tournamentId: string; matchUpId: string }> {
  return page.evaluate(
    async ({ date, scheduledTime, providerId }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Auto Call',
        tournamentAttributes: { tournamentId: 'e2e-auto-call', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 1, venueName: 'Auto Venue' }],
      });

      const court = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts[0];
      const match = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
        (m: any) =>
          m.matchUpStatus !== 'BYE' &&
          (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
      );

      dev.factory.tournamentEngine.addMatchUpScheduleItems({
        matchUpId: match.matchUpId,
        drawId: match.drawId,
        schedule: {
          scheduledDate: date,
          venueId: court.venueId,
          courtId: court.courtId,
          courtOrder: 1,
          ...(scheduledTime ? { scheduledTime } : {}),
        },
      });

      const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      // Provider-scope the tournament so isTournamentProviderMember can match it
      // against the seeded provider-member JWT (auto-call gate). Sync it into
      // engine state too: `setState:true` already loaded a parent-less record, and
      // loadTournament short-circuits when the engine already holds this id — so
      // without this re-setState, goto would serve the parent-less in-memory copy.
      rec.parentOrganisation = {
        organisationId: providerId,
        organisationName: 'E2E Provider',
        organisationAbbreviation: 'E2EP',
      };
      dev.factory.tournamentEngine.setState(rec);
      await dev.tmx2db.addTournament(rec);
      return { tournamentId: tournamentRecord.tournamentId as string, matchUpId: match.matchUpId as string };
    },
    { date, scheduledTime, providerId: PROVIDER_ID },
  );
}

test.describe('Journey 61 — now-strip auto-call due-gating', () => {
  // Read per test, not at module load, so a suite crossing midnight cannot seed yesterday.
  let date: string;

  test.beforeEach(async ({ page }) => {
    date = todayLocal();
    // No offset → parsed as LOCAL time, the same zone the browser runs in. The strip and
    // the due-gate read the venue frame, which falls back to the browser zone because the
    // mock tournament carries no localTimeZone.
    await page.clock.setFixedTime(new Date(`${date}T${PINNED_TIME}`));
    await isolateFromCfs(page);
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('a due pending match on a free court is auto-called on strip render', async ({ page }) => {
    // No scheduledTime → due now → should be called.
    const seed = await seedOnePlaced(page, date);
    const collector = createMutationCollector(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await loginAsProviderMember(page, PROVIDER_ID);
    await forceLocalExecution(page);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP, { timeout: 10_000 });

    const entry = await collector.waitForMethod('setMatchUpCalledAt', 10_000);
    const calledId = (entry.methods.find((m) => m.method === 'setMatchUpCalledAt')?.params as any)?.matchUpId;
    expect(calledId).toBe(seed.matchUpId);

    collector.detach();
  });

  test('a match with a future scheduledTime is NOT auto-called', async ({ page }) => {
    // Strictly after the pinned noon → keep waiting → no call.
    await seedOnePlaced(page, date, '23:59');
    const collector = createMutationCollector(page);

    const tournament = new TournamentPage(page);
    await tournament.goto('e2e-auto-call');
    await loginAsProviderMember(page, PROVIDER_ID);
    await forceLocalExecution(page);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP, { timeout: 10_000 });

    // Let the mount-time auto-call pass settle (the 30s ticker won't fire in-window).
    await page.waitForTimeout(1500);
    expect(collector.hasMethod('setMatchUpCalledAt')).toBe(false);

    collector.detach();
  });
});
