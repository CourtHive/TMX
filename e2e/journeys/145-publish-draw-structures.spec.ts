import { TournamentPage } from '../pages/TournamentPage';
import { initDevBridge } from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';
import { test, expect } from '@playwright/test';
import { AuthFlow } from '../pages/AuthFlow';
import {
  SERVER,
  ensureProvider,
  deleteProvider,
  uniqueSuffix,
  uniqueAbbr,
  signInSuperAdmin,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
} from '../helpers/role-fixtures';

/**
 * Journey 145 — publishing individual structures of a draw.
 *
 * A draw with a qualifying structure lists its structures beneath it on the Publishing tab, collapsed by
 * default, so qualifying can be published while MAIN stays withheld until qualifying is done.
 *
 * Asserted: the draw row starts collapsed with its structure rows hidden; expanding it shows one
 * Structure row per structure; and once the draw is published qualifying-only, the draw opens on its own
 * and MAIN reads Off while qualifying reads Live.
 *
 * The qualifying-only publish is applied through the factory engine, for the reason journey 71
 * documents: a locally-seeded tournament is unknown to the server, so a serverFirst mutation would
 * round-trip to nothing. The params the toggle sends are pinned by structurePublishing.test.ts.
 *
 * Requires the local CFS at SERVER (publishing is login-gated); skips cleanly when it is absent.
 */

const TABLE = '#publishingEventsTable';
const STRUCTURE_ROWS = `${TABLE} .tabulator-row:has(.tabulator-cell[tabulator-field="type"]:text-is("Structure"))`;
const DRAW_ROW = `${TABLE} .tabulator-row:has(.tabulator-cell[tabulator-field="type"]:text-is("Draw"))`;

const PROVIDER_ABBR = uniqueAbbr('S');
const PROVIDER_NAME = `E2E Structure Publish ${uniqueSuffix()}`;

const QUALIFYING_TOURNAMENT = {
  tournamentName: 'E2E Structure Publishing',
  tournamentAttributes: { tournamentId: 'e2e-structure-publishing' },
  drawProfiles: [
    {
      drawSize: 16,
      qualifyingProfiles: [{ structureProfiles: [{ drawSize: 16, qualifyingPositions: 4 }] }],
    },
  ],
};

let seeded = false;
let token: string | null = null;
let providerId: string | undefined;

test.describe('Journey 145 — publishing individual draw structures', () => {
  test.beforeAll(async ({ request }) => {
    token = await signInSuperAdmin(request);
    if (!token) return undefined;
    providerId = await ensureProvider(request, token, PROVIDER_ABBR, PROVIDER_NAME);
    seeded = true;
  });

  test.afterAll(async ({ request }) => {
    if (!token) return undefined;
    await deleteProvider(request, token, providerId, PROVIDER_ABBR);
  });

  test('structures are listed collapsed, and a qualifying-only publish shows MAIN off', async ({ page }) => {
    test.skip(!seeded, `CFS at ${SERVER} / bootstrap super-admin unavailable`);

    const auth = new AuthFlow(page);
    await auth.login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await auth.selectProvider(PROVIDER_NAME);

    await initDevBridge(page);
    const tournamentId = await seedTournament(page, QUALIFYING_TOURNAMENT);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await page.locator('#b-route').click();

    // The draw is listed (events start expanded) but its structures do not show until it is opened.
    const drawRow = page.locator(DRAW_ROW);
    await drawRow.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator(STRUCTURE_ROWS)).toHaveCount(0);

    await drawRow.locator('.tabulator-data-tree-control').click();
    await expect(page.locator(STRUCTURE_ROWS)).toHaveCount(2);

    // Publish the draw with only its qualifying structure visible.
    const published = await page.evaluate(() => {
      const engine = dev.factory.tournamentEngine;
      const event = engine.getEvents().events[0];
      const drawDefinition = event.drawDefinitions[0];
      const structureDetails = Object.fromEntries(
        drawDefinition.structures.map((s: any) => [s.structureId, { published: s.stage === 'QUALIFYING' }]),
      );
      const result = engine.publishEvent({
        eventId: event.eventId,
        drawDetails: { [drawDefinition.drawId]: { publishingDetail: { published: true }, structureDetails } },
      });
      return result?.success === true;
    });
    expect(published).toBe(true);

    await tournament.navigateToOverview();
    await page.locator('#b-route').click();
    await page.locator(DRAW_ROW).waitFor({ state: 'visible', timeout: 10_000 });

    // Published selectively, so the draw opens without being clicked and each structure shows its state.
    const structureRows = page.locator(STRUCTURE_ROWS);
    await expect(structureRows).toHaveCount(2);
    await expect(structureRows.filter({ hasText: /qualifying/i }).locator('.pub-state-badge')).toHaveClass(
      /pub-state-live/,
    );
    await expect(structureRows.filter({ hasText: /main/i }).locator('.pub-state-badge')).toHaveClass(/pub-state-off/);
  });
});
