import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 57 — MatchUps page "Called" (calledAt) column, hidden by default
 *
 * The matchUps table gained a `calledAt` column (ISO strip-drop timestamp,
 * rendered as local HH:MM by calledAtFormatter). It ships hidden by default and
 * is toggled via the shared header column-selector menu (visibility persisted to
 * context.columns / localStorage `tmx_columns`, keyed globally by field).
 *
 * Asserts: the column renders no header/cells by default; enabling it via the
 * header menu reveals the header + a formatted HH:MM value for a matchUp that
 * carries a calledAt stamp; the preference persists.
 */

const MATCHUPS = `#${'tournamentMatchUps'}`; // S.TOURNAMENT_MATCHUPS
const CALLED_COL = `${MATCHUPS} .tabulator-col[tabulator-field="calledAt"]`;
const CALLED_CELL = `${MATCHUPS} .tabulator-cell[tabulator-field="calledAt"]`;

/** Seed a tournament and stamp calledAt on the first playable matchUp in one
 *  persist. Returns the tournamentId + stamped matchUpId. */
async function seedWithCalledAt(page: Page): Promise<{ tournamentId: string; matchUpId: string }> {
  return page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E CalledAt Column',
      tournamentAttributes: { tournamentId: 'e2e-calledat-column' },
      participantsProfile: { scaledParticipantsCount: 16 },
      drawProfiles: [{ eventName: 'Called Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
    });

    const mu = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
      (m: any) =>
        m.matchUpStatus !== 'BYE' &&
        (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
    );
    if (!mu) throw new Error('No playable matchUp in seeded draw');

    dev.factory.tournamentEngine.setMatchUpCalledAt({
      matchUpId: mu.matchUpId,
      drawId: mu.drawId,
      calledAt: new Date().toISOString(),
    });

    const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
    await dev.tmx2db.addTournament(rec);
    return { tournamentId: tournamentRecord.tournamentId as string, matchUpId: mu.matchUpId as string };
  });
}

test.describe('Journey 57 — MatchUps "Called" column (hidden by default)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    // Column visibility is a global field-keyed map in localStorage — clear so
    // the calledAt column starts at its default (hidden).
    await page.evaluate(() => localStorage.clear());
  });

  test('is hidden by default, then toggles on to show a formatted time', async ({ page }) => {
    const seed = await seedWithCalledAt(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToMatchUps();
    await page.waitForSelector(`${MATCHUPS} .tabulator-row`, { state: 'visible', timeout: 10_000 });

    // Default: the calledAt header + cells are hidden (Tabulator keeps
    // display:none .tabulator-col/.tabulator-cell elements for hidden columns).
    await expect(page.locator(CALLED_COL)).toBeHidden();
    await expect(page.locator(CALLED_CELL).first()).toBeHidden();
    // Sanity: a normally-visible column IS shown (guards against an empty table).
    await expect(page.locator(`${MATCHUPS} .tabulator-col[tabulator-field="eventId"]`)).toBeVisible();

    // Open the header column-selector menu (revealed on header hover).
    const menuCol = page
      .locator(`${MATCHUPS} .tabulator-col`)
      .filter({ has: page.locator('.tabulator-header-popup-button') })
      .first();
    await menuCol.hover();
    await page.locator(`${MATCHUPS} .tabulator-header-popup-button`).first().click({ force: true });
    const menu = page.locator('.tabulator-menu');
    await menu.waitFor({ state: 'visible', timeout: 5_000 });

    // Toggle "Called" on.
    await menu.locator('.tabulator-menu-item', { hasText: 'Called' }).first().click();
    await page.waitForTimeout(300);

    // The column header now renders...
    await expect(page.locator(CALLED_COL)).toBeVisible();

    // ...and the stamped matchUp shows a formatted local HH:MM value.
    await expect(async () => {
      const texts = await page.locator(CALLED_CELL).allInnerTexts();
      expect(texts.some((tx) => /^\d{2}:\d{2}$/.test(tx.trim()))).toBe(true);
    }).toPass({ timeout: 5_000 });

    // Preference persisted to localStorage (context.columns).
    const persisted = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('tmx_columns') || '{}').calledAt;
      } catch {
        return undefined;
      }
    });
    expect(persisted).toBe(true);
  });
});
