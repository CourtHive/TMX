import { initDevBridge, resetState, seedFeatureFlagInitScript, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_COMPLETED, type MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

// `cModal` mounts each modal as `<section id="cmdl-<n>">` (courthive-components
// `cmodal.ts:230`) — no stable single id, hence the prefix. Assert on the dialog
// rather than the section: the section is `display:block` around a
// `position:fixed` container (`draw.css:243`), so its own box is zero-height and
// Playwright rightly reports it as not visible.
const MODAL = 'section[id^="cmdl-"] .chc-modal-dialog';

/**
 * Journey 107 — a participant name in a report opens the participant card.
 *
 * Two assertions, and the second is the one that matters. Reports whose rows
 * carry `eventId` + `drawId` are row-click navigable (journey 68), and the
 * participant column lives inside those same rows. `renderIndividual` calls
 * `pointerEvent.stopPropagation()` before invoking `participantClick`, so the
 * name click must open the card and NOT also navigate to the draw behind it.
 *
 * Without that guarantee the feature is worse than absent: every card open
 * would drop the operator into a draw they did not ask for.
 */

test.describe('Journey 107 — reports participant card', () => {
  test.beforeEach(async ({ page }) => {
    await seedFeatureFlagInitScript(page, 'reports');
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('clicking a participant name opens the card without navigating to the draw', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_COMPLETED);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    // Prefer a report that is BOTH participant-bearing and row-navigable, so the
    // click genuinely exercises the stopPropagation path rather than a report
    // where there is no navigation to suppress.
    const found = await page.evaluate(() => {
      const avail: any = dev.factory.tournamentEngine.getAvailableReports?.() ?? {};
      const reports = (avail.availableReports ?? []).filter((r: any) => r.computableNow && r.source !== 'server');
      let fallback: string | null = null;
      for (const r of reports) {
        const res: any = dev.factory.tournamentEngine.generateReport({ reportId: r.reportId });
        const rows: any[] = res?.rows ?? [];
        if (!rows.length || !rows[0].participantId) continue;
        if (rows[0].eventId && rows[0].drawId) return { reportId: r.reportId as string, navigable: true };
        fallback ??= r.reportId;
      }
      return { reportId: fallback, navigable: false };
    });
    expect(found.reportId, 'no participant-bearing local report found').toBeTruthy();

    await page.evaluate(
      ({ id, reportId }) => {
        window.location.hash = `#/tournament/${id}/reports/${reportId}`;
      },
      { id: tournamentId, reportId: found.reportId },
    );

    const rows = page.locator('#tournamentReports .tabulator-row');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });

    // `renderIndividual` tags every rendered name with `.tmx-i`.
    const participantName = rows.first().locator('.tmx-i').first();
    await expect(participantName).toBeVisible({ timeout: 10_000 });
    const clickedName = (await participantName.textContent())?.trim();

    await participantName.click();

    // The card opened, titled with the participant that was clicked.
    const modal = page.locator(MODAL);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    if (clickedName) await expect(modal).toContainText(clickedName, { timeout: 5_000 });

    // ...and the row-click navigation did NOT also fire.
    await expect(page.locator(S.DRAW_FRAME)).toBeHidden();
  });

  test('a doubles entry renders both partners, each opening its own card', async ({ page }) => {
    // The PAIR case is why the column renders `sideBySide` and why participants
    // are hydrated `withIndividualParticipants`. Without either, a doubles PAIR is
    // ONE unclickable name — `participantProfileModal` is person-oriented
    // throughout and would render an empty card for the pair itself.
    //
    // Seeding Performance is the report that actually produces PAIR rows. Entry
    // Status does NOT: mocksEngine enters a doubles event as individuals, so its
    // rows come back INDIVIDUAL even when the tournament holds 8 PAIRs. Measured
    // across every local report on a seeded doubles tournament — only
    // `participant.seedingPerformance` returned PAIR rows.
    const doublesProfile: MockProfile = {
      tournamentName: 'E2E Doubles Reports',
      tournamentAttributes: { tournamentId: 'e2e-doubles-reports' },
      participantsProfile: { scaledParticipantsCount: 32 },
      drawProfiles: [
        { eventName: 'Doubles', eventType: 'DOUBLES', drawSize: 8, seedsCount: 4, drawType: 'SINGLE_ELIMINATION' },
      ],
      completeAllMatchUps: true,
    };
    const tournamentId = await seedTournament(page, doublesProfile);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    // Guard against a vacuous test: if the seed stops producing PAIR rows this
    // fails loudly rather than silently exercising the INDIVIDUAL path twice.
    const pairRowFound = await page.evaluate(() => {
      const res: any = dev.factory.tournamentEngine.generateReport({ reportId: 'participant.seedingPerformance' });
      const rows: any[] = res?.rows ?? [];
      const participants = dev.factory.tournamentEngine.getParticipants({}).participants ?? [];
      const byId: Record<string, any> = {};
      for (const p of participants) byId[p.participantId] = p;
      return rows.some((r: any) => byId[r.participantId]?.participantType === 'PAIR');
    });
    expect(pairRowFound, 'seed produced no PAIR rows — the doubles case would be untested').toBe(true);

    await page.evaluate((id) => {
      window.location.hash = `#/tournament/${id}/reports/participant.seedingPerformance`;
    }, tournamentId);

    const firstRow = page.locator('#tournamentReports .tabulator-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });

    // Both partners are rendered as independent click targets in the one cell.
    const names = firstRow.locator('.tmx-i');
    await expect(names).toHaveCount(2, { timeout: 10_000 });

    const secondName = (await names.nth(1).textContent())?.trim();
    await names.nth(1).click();

    // Clicking the SECOND partner opens THAT partner's card, not the first's —
    // which is what proves the click resolves the individual rather than the pair.
    const modal = page.locator(MODAL);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    if (secondName) await expect(modal).toContainText(secondName, { timeout: 5_000 });
  });
});
