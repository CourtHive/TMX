/**
 * Journey 118 — the four DrawMatic round-view tabs, Ratings included.
 *
 * The production bug this exists for: on a DrawMatic (AD_HOC) draw with completed
 * rounds, Columns / Table / Stats rendered and **Ratings** threw
 * `scaleEngine.generateDynamicRatings is not a function`, taking the whole draw view
 * down with it.
 *
 * The cause was not in TMX. `scaleEngine` is the factory's shared `syncEngine`
 * singleton with the ranking + ratings governors bolted on by `importMethods`, and
 * the factory re-exported it as a plain alias — so its ESM build emitted the
 * attaching module as a bare side-effect import, which `"sideEffects": false` then
 * licensed TMX's bundler to drop. The engine still arrived, still had `setState`,
 * and lost only the ratings methods.
 *
 * ⚠️ READ THIS BEFORE TRUSTING A GREEN RUN. Tree shaking is a **production build**
 * behaviour. Under the default dev-server run (`pnpm test:e2e`) Vite serves
 * unbundled ESM, every module is evaluated, and this spec passes even against a
 * factory carrying the bug. Only `pnpm test:e2e:prod` (TEST_PROD=1 → `vite build` +
 * `vite preview`) reproduces it. The dev-mode run is still worth having — it guards
 * the tabs against ordinary TMX regressions — but the shaking class itself is held
 * by the factory's own `verify:runtime` bundled smoke, which runs in `pnpm verify`.
 *
 * Asserted here:
 *   - all four tabs are offered on an AD_HOC draw (Ratings is AD_HOC-only)
 *   - visiting each in turn raises no uncaught page error
 *   - Ratings renders real content — a row per drawn participant, a per-round
 *     column for each of the three rounds, and a populated dynamic-rating column.
 *     That last one matters: it fails if `generateDynamicRatings` is missing, and
 *     equally if it is present but returns nothing, which a smoke test that only
 *     watched for a thrown error would wave through.
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect, type Page } from '@playwright/test';
import { S } from '../helpers/selectors';

const DRAW_SIZE = 8;
const ROUNDS_COUNT = 3;

/**
 * A DrawMatic draw with every matchUp of all three rounds played. `scaleAllParticipants`
 * plus the WTN category is what gives `generateDynamicRatings` a source rating to move
 * away from — without it the dynamic column is legitimately absent and the strongest
 * assertion below would have nothing to bite on.
 */
const DRAWMATIC_PROFILE: MockProfile = {
  tournamentName: 'E2E DrawMatic Ratings',
  tournamentAttributes: { tournamentId: 'e2e-drawmatic-ratings' },
  participantsProfile: { idPrefix: 'P', scaleAllParticipants: true },
  drawProfiles: [
    {
      category: { ratingType: 'WTN', ratingMin: 10, ratingMax: 16 },
      eventName: 'DrawMatic Singles',
      drawType: 'AD_HOC',
      scaleName: 'WTN',
      automated: true,
      roundsCount: ROUNDS_COUNT,
      drawSize: DRAW_SIZE,
    },
  ],
  completeAllMatchUps: true,
  randomWinningSide: true,
};

/** The round-view tab strip lives in the draw control bar's LEFT slot. */
function roundTab(page: Page, label: string) {
  return page.locator(`${S.DRAW_CONTROL} .options_left .tabs li a span`, { hasText: label });
}

/**
 * Tabulator converts the element it is handed rather than nesting inside it, so the
 * mounted table is `#drawsView` itself carrying `.tabulator` — not a descendant.
 * Assert on a header cell, which is a descendant either way.
 */
function mountedTable(page: Page) {
  return page.locator(`${S.DRAWS_VIEW} .tabulator-col-title`).first();
}

/**
 * Open a round-view tab and wait for its table.
 *
 * When the renderer throws, the only visible symptom is that nothing mounts, and a
 * bare "element not found" says nothing about why. Re-throw with the uncaught page
 * errors attached so the failure names its own cause — for the bug this spec was
 * written for, that is the literal
 * `scaleEngine.generateDynamicRatings is not a function`.
 */
async function showTab(page: Page, label: string, pageErrors: string[]): Promise<void> {
  await roundTab(page, label).click();
  try {
    await expect(mountedTable(page)).toBeVisible({ timeout: 10_000 });
  } catch (cause) {
    throw new Error(`the ${label} tab mounted no table. Uncaught page errors: ${pageErrors.join(' | ') || '(none)'}`, {
      cause,
    });
  }
}

/** Tabulator column headers currently mounted in the draws view. */
async function columnTitles(page: Page): Promise<string[]> {
  return page
    .locator(`${S.DRAWS_VIEW} .tabulator-col .tabulator-col-title`)
    .allTextContents()
    .then((titles) => titles.map((t) => t.replace(/\s+/g, ' ').trim()));
}

async function seedAndOpenDraw(page: Page): Promise<void> {
  const tournamentId = await seedTournament(page, DRAWMATIC_PROFILE);
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToEvents();
  await page.locator(`${S.EVENTS_TABLE} .tabulator-row`).first().click();
  await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 10_000 });
}

test.describe('Journey 118 — DrawMatic round-view tabs', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    // An uncaught TypeError inside createRatingsTable propagates out through
    // renderDrawView → eventsTab → the router handler, so it surfaces here rather
    // than as a failed locator. Collect from the very first navigation.
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('offers Columns | Table | Stats | Ratings and every one renders without error', async ({ page }) => {
    await seedAndOpenDraw(page);

    // Ratings and Stats are offered only for AD_HOC / round-robin structures, so their
    // presence is itself the check that the seed really produced a DrawMatic draw.
    for (const label of ['Columns', 'Table', 'Stats', 'Ratings']) {
      await expect(roundTab(page, label)).toHaveCount(1);
    }

    for (const label of ['Table', 'Stats', 'Ratings']) {
      await showTab(page, label, pageErrors);
      expect(pageErrors, `uncaught error while rendering the ${label} tab`).toEqual([]);
    }

    // Back to the default view, to confirm the round trip leaves the draw intact.
    await roundTab(page, 'Columns').click();
    expect(pageErrors, 'uncaught error returning to the Columns tab').toEqual([]);
  });

  test('Ratings renders per-round results and a populated dynamic rating', async ({ page }) => {
    await seedAndOpenDraw(page);
    await showTab(page, 'Ratings', pageErrors);

    // This is the assertion that would have caught the production bug. When
    // `generateDynamicRatings` is missing the click throws and nothing mounts;
    // when it is present but yields nothing, `hasDynamic` stays false and the
    // dynamic column is never appended.
    expect(pageErrors, 'Ratings tab raised an uncaught error').toEqual([]);

    const titles = await columnTitles(page);
    expect(titles).toContain('Participant');
    expect(titles).toContain('Scorelines');
    for (const rn of [1, 2, 3]) expect(titles).toContain(`R${rn}`);

    // The dynamic column is titled `ELO(from <scale>)` when the ratings were converted
    // to ELO (which this fixture's WTN source triggers) and plain `Dynamic` otherwise.
    // Accept either, so the spec survives a change of source scale, and require the
    // `Change` column too — it is appended only alongside a dynamic rating.
    const dynamicTitle = titles.find((t) => /^(ELO|Dynamic)\b/.test(t));
    expect(dynamicTitle, `no dynamic rating column among: ${titles.join(' | ')}`).toBeTruthy();
    expect(titles, `no rating-change column among: ${titles.join(' | ')}`).toContain('Change');

    // One row per participant drawn into the structure.
    await expect(page.locator(`${S.DRAWS_VIEW} .tabulator-row`)).toHaveCount(DRAW_SIZE);

    // Every round column carries a settled result, since the seed completes them all.
    const firstRowResults = page.locator(`${S.DRAWS_VIEW} .tabulator-row`).first().locator('.tabulator-cell');
    await expect(firstRowResults.filter({ hasText: /^[WL]$/ })).toHaveCount(ROUNDS_COUNT);

    // And the dynamic column holds a number rather than the '-' placeholder.
    const dynamicIndex = titles.indexOf(dynamicTitle as string);
    const dynamicCell = page
      .locator(`${S.DRAWS_VIEW} .tabulator-row`)
      .first()
      .locator('.tabulator-cell')
      .nth(dynamicIndex);
    await expect(dynamicCell).toHaveText(/\d/);
  });
});
