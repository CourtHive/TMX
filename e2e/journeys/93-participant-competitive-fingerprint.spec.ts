/**
 * The participant profile modal's inline competitive fingerprint (§6.2 of
 * Mentat/planning/COMPETITIVE_FINGERPRINT.md).
 *
 * This lives in e2e rather than vitest because the block is DOM, and TMX's
 * vitest runs in node with no DOM. It also guards the one thing the unit tests
 * structurally CANNOT: that the engine call hydrates ratings onto the matchUp
 * side participants. `withScaleValues` nested inside `contextProfile` returns
 * `ratings: {}`, the exposure axis silently finds nothing to band, and the bar
 * quietly disappears — no error anywhere. The unit tests hand `fingerprintData`
 * its matchUps, so only a real render catches that regression.
 */
import { initDevBridge, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { seedTournament } from '../helpers/seed';
import { test, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

const FINGERPRINT = '.tmx-fp';
const SEGMENTS = `${FINGERPRINT} .chc-sb__seg`;

test.describe('participant competitive fingerprint', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
  });

  test('bands the participant against WTN-rated opponents', async ({ page }) => {
    // Round robin so one participant plays several opponents; WTN so the signed
    // exposure axis has a scale the factory can orient.
    const tournamentId = await seedTournament(page, {
      drawProfiles: [
        { drawSize: 8, drawType: 'ROUND_ROBIN', category: { ratingType: 'WTN' }, completionGoal: 28 } as any,
      ],
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToParticipants();

    const rows = page.locator(`${S.TOURNAMENT_PARTICIPANTS} .tabulator-row`);
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    await rows
      .first()
      .getByText(/[A-Za-z]+ [A-Za-z]+/)
      .first()
      .click();

    const fingerprint = page.locator(FINGERPRINT);
    await expect(fingerprint).toBeVisible({ timeout: 10_000 });

    // Five segments, because the default policy declares five bands — the bar
    // reads its vocabulary from policy, not from a hardcoded list.
    await expect(page.locator(SEGMENTS)).toHaveCount(5);

    const report = await fingerprint.evaluate((el) => {
      const segs = [...el.querySelectorAll('.chc-sb__seg')] as HTMLElement[];
      return {
        text: el.textContent ?? '',
        keys: segs.map((s) => s.dataset.key),
        counts: segs.map((s) => Number(s.textContent || 0)),
        // Every fill must resolve — an unset custom property would render
        // transparent and the bar would look empty rather than broken.
        backgrounds: segs.map((s) => getComputedStyle(s).backgroundColor),
      };
    });

    expect(report.keys).toEqual(['STRETCH', 'UP', 'EVEN', 'DOWN', 'ANCHOR']);
    expect(report.backgrounds.every((bg) => bg && bg !== 'rgba(0, 0, 0, 0)')).toEqual(true);

    // The exposure axis actually resolved: at least one opponent was rated, and
    // the counts add up to the rated total stated in the coverage line.
    const rated = Number(/(\d+) rated on WTN/.exec(report.text)?.[1] ?? 0);
    expect(rated).toBeGreaterThan(0);
    expect(report.counts.reduce((a, b) => a + b, 0)).toEqual(rated);

    // Coverage names the scale, so the bar is never a shape without provenance.
    expect(report.text).toContain('WTN');
  });
});
