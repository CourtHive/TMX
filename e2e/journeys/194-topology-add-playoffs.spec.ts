import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { getTournamentRecord, seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * The topology's Add playoffs mode (CA, 2026-11-08).
 *
 * A director with a 32-entry round robin and a 1-16 playoff had to open each structure's menu to learn that the round
 * robin could still feed 17-24 and 25-32, and the playoff 9-16, 5-8 and 3-4. The topology now shows a chip per range
 * in its Add playoffs mode, from the live draw, and a chip attaches that one playoff.
 */
const RR_PROFILE = {
  tournamentName: 'Topology Add Playoffs E2E',
  tournamentAttributes: { tournamentId: 'e2e-topology-playoffs-001' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [
    {
      eventName: 'RR Singles',
      drawSize: 32,
      drawType: 'ROUND_ROBIN_WITH_PLAYOFF',
      structureOptions: {
        groupSize: 4,
        playoffGroups: [{ finishingPositions: [1, 2], structureName: 'Playoff 1-16' }],
      },
    },
  ],
};

const SE_PROFILE = {
  tournamentName: 'Topology Single Structure E2E',
  tournamentAttributes: { tournamentId: 'e2e-topology-single-001' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'SE Singles', drawSize: 16 }],
};

const TOGGLE = 'button.tb-mode-toggle[data-mode="addPlayoffs"]';
const OFFER = '.tb-card-offer';

async function openTopology(page: any, profile: any) {
  const tournamentId = await seedTournament(page, profile);
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToEvents();
  await page.locator(`${S.EVENTS_TABLE} .tabulator-row`).first().click();
  await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 10_000 });

  const topologyBtn = page.locator(S.EVENT_CONTROL).locator('i.fa-sitemap');
  await expect(topologyBtn).toBeVisible({ timeout: 5_000 });
  await topologyBtn.click();
  const canvas = page.locator(S.DRAWS_VIEW).locator('.tb-canvas');
  await expect(canvas).toBeVisible({ timeout: 5_000 });
  return canvas;
}

const card = (canvas: any, name: string) =>
  canvas
    .locator('.tb-card')
    .filter({ has: canvas.page().locator('.tb-card-name', { hasText: new RegExp(`^${name}$`) }) });

test.describe('Topology — Add playoffs mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('the topology button is offered for a draw with a single structure', async ({ page }) => {
    const canvas = await openTopology(page, SE_PROFILE);
    await expect(canvas.locator('.tb-card')).toHaveCount(1);

    await page.locator(TOGGLE).click();
    // a 16 draw can play off 3-4 (or 1-4 as a page playoff), 5-8 and 9-16, and take a voluntary consolation
    await expect(canvas.locator(OFFER)).toHaveText([
      '+ Page playoff 1–4',
      '+ 3–4',
      '+ 5–8',
      '+ 9–16',
      '+ Voluntary consolation',
    ]);
  });

  test('chips come from the live draw, and one attaches that one playoff', async ({ page }) => {
    const canvas = await openTopology(page, RR_PROFILE);
    await expect(canvas.locator(OFFER)).toHaveCount(0);

    await page.locator(TOGGLE).click();
    await expect(page.locator(TOGGLE)).toHaveAttribute('aria-pressed', 'true');
    await expect(card(canvas, 'Main').locator(OFFER)).toHaveText(['+ 17–24', '+ 25–32']);
    await expect(card(canvas, 'Playoff 1-16').locator(OFFER)).toHaveText([
      '+ Page playoff 1–4',
      '+ 3–4',
      '+ 5–8',
      '+ 9–16',
    ]);

    await card(canvas, 'Playoff 1-16').locator(`${OFFER}[data-finishing-position-range="5-8"]`).click();

    // the draw has the playoff, the topology was read again from it, and the mode is still on
    await expect(card(canvas, 'Playoff 5-8')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(TOGGLE)).toHaveAttribute('aria-pressed', 'true');
    await expect(card(canvas, 'Playoff 1-16').locator(OFFER)).toHaveText(['+ Page playoff 1–4', '+ 3–4', '+ 9–16']);

    const record: any = await getTournamentRecord(page);
    const names = record.events[0].drawDefinitions[0].structures.map((s: any) => s.structureName);
    expect(names).toEqual(['Main', 'Playoff 1-16', 'Playoff 5-8']);
  });

  test('fills the window top to bottom, footer included, and follows a resize', async ({ page }) => {
    // A tall screen, as on Lenz: the canvas stopped at a fixed height and left the rest of the window bare (CA)
    await page.setViewportSize({ width: 1620, height: 1200 });
    const canvas = await openTopology(page, RR_PROFILE);

    const footerGap = async () =>
      page.evaluate(() => {
        const footer = document.querySelector('.tmx-topology-host .tb-footer') as HTMLElement;
        return window.innerHeight - footer.getBoundingClientRect().bottom;
      });

    await expect(page.locator('.tmx-topology-host .tb-footer')).toBeVisible();
    // the helper leaves an 8px page margin under the footer, nothing more. Polled on the BAND: a one-sided bound is
    // already true of the stale layout a resize has not reached yet, and passes before the refit happens.
    const inBand = async () => {
      const gap = await footerGap();
      return gap >= 7 && gap <= 9;
    };
    await expect.poll(inBand).toBe(true);
    // and the grid reaches the footer: the canvas is the tall part of the layout, not a 600px box
    const canvasHeight = await canvas.evaluate((el: HTMLElement) => el.getBoundingClientRect().height);
    expect(canvasHeight).toBeGreaterThan(800);

    await page.setViewportSize({ width: 1620, height: 900 });
    await expect.poll(inBand).toBe(true);

    // the footer says what the Add playoffs mode asks
    await page.locator(TOGGLE).click();
    await expect(page.locator('.tmx-topology-host .tb-footer-hint')).toHaveText(
      '6 structures can still be added — choose a chip to add it',
    );
  });

  test('a page playoff replaces 3-4, and a voluntary consolation sits beside the main draw', async ({ page }) => {
    const canvas = await openTopology(page, SE_PROFILE);
    await page.locator(TOGGLE).click();
    const main = card(canvas, 'Main');
    await expect(main.locator(OFFER)).toHaveText([
      '+ Page playoff 1–4',
      '+ 3–4',
      '+ 5–8',
      '+ 9–16',
      '+ Voluntary consolation',
    ]);

    await main.locator(`${OFFER}[data-kind="pagePlayoff"]`).click();
    await expect(card(canvas, 'Playoff Final')).toBeVisible({ timeout: 5_000 });
    // the factory no longer offers 3-4, so both alternatives are gone
    await expect(main.locator(OFFER)).toHaveText(['+ 5–8', '+ 9–16', '+ Voluntary consolation']);

    await main.locator(`${OFFER}[data-kind="voluntaryConsolation"]`).click();
    const vc = card(canvas, 'Consolation');
    await expect(vc).toBeVisible({ timeout: 5_000 });
    await expect(vc.locator('.tb-card-badge')).toHaveText('VC');
    await expect(main.locator(`${OFFER}[data-kind="voluntaryConsolation"]`)).toHaveCount(0);

    const record: any = await getTournamentRecord(page);
    const structures = record.events[0].drawDefinitions[0].structures.map((s: any) => [s.stage, s.structureName]);
    expect(structures).toEqual([
      ['MAIN', 'Main'],
      ['PLAY_OFF', '3-4 Playoff'],
      ['PLAY_OFF', 'Playoff Qualifier'],
      ['PLAY_OFF', 'Playoff Final'],
      ['VOLUNTARY_CONSOLATION', 'Consolation'],
    ]);
  });
});
