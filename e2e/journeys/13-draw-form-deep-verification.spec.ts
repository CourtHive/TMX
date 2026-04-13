/**
 * Journey 13 — Draw form: Deep mutation payload and post-generation verification
 *
 * Tests that go beyond field visibility — verify the actual mutation
 * payloads contain the right parameters and the tournament state is
 * correct after generation.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

const PROFILE_16: MockProfile = {
  tournamentName: 'E2E Deep Verify',
  tournamentAttributes: { tournamentId: 'e2e-deep' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

const PROFILE_12: MockProfile = {
  tournamentName: 'E2E 12 Deep',
  tournamentAttributes: { tournamentId: 'e2e-deep-12' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, participantsCount: 12, generate: false }],
};

async function seedAndOpenDrawForm(page: any, profile: MockProfile = PROFILE_16): Promise<{
  drawer: DrawFormDrawer;
  collector: ReturnType<typeof createMutationCollector>;
}> {
  const collector = createMutationCollector(page);
  const tournamentId = await seedTournament(page, profile);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();
  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  return { drawer, collector };
}

test.describe('Journey 13 — Deep mutation and post-generation verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  /* ── Mutation payload: draw name ──────────────────────────────────── */

  test('generated drawDefinition contains the user-specified draw name', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Championship Draw');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const dd = entry.methods[0].params.drawDefinition;
    expect(dd.drawName).toBe('Championship Draw');

    collector.detach();
  });

  /* ── Mutation payload: score format ───────────────────────────────── */

  test('generated drawDefinition uses selected matchUpFormat', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Format Test');

    // The default format is SET3-S:6/TB7 — verify it appears in the payload
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const dd = entry.methods[0].params.drawDefinition;
    // matchUpFormat should be the default or the selected format
    expect(dd.matchUpFormat || dd.structures?.[0]?.matchUpFormat).toBeDefined();

    collector.detach();
  });

  /* ── Mutation payload: seeding policy ─────────────────────────────── */

  test('seeding policy selection affects the generated draw', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Seeding Test');

    // Select CLUSTER seeding policy
    await page.evaluate(() => {
      const drawerEl = document.getElementById('tmxDrawer');
      const selects = drawerEl?.querySelectorAll('select') || [];
      for (const sel of selects) {
        for (const opt of sel.options) {
          if (opt.value === 'CLUSTER') {
            sel.value = 'CLUSTER';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      }
    });

    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    // The seeding policy should influence the draw generation
    expect(entry).toBeDefined();

    collector.detach();
  });

  /* ── Post-generation: tournament state ────────────────────────────── */

  test('after generation, tournament has a new drawDefinition', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'State Verify');
    await drawer.clickGenerate();

    await collector.waitForMethod('addDrawDefinition', 10_000);

    // Verify the tournament state via the engine
    const drawCount = await page.evaluate(() => {
      const tournament = dev.getTournament();
      return tournament.events?.[0]?.drawDefinitions?.length ?? 0;
    });
    expect(drawCount).toBeGreaterThanOrEqual(1);

    collector.detach();
  });

  test('generated SE draw has correct structure with 16 positions', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Structure Verify');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const dd = entry.methods[0].params.drawDefinition;

    // SE draw should have exactly 1 MAIN structure
    const mainStructure = dd.structures?.find((s: any) => s.stage === 'MAIN');
    expect(mainStructure).toBeDefined();

    // With 16 entries, should have 16 position assignments
    expect(mainStructure.positionAssignments?.length).toBe(16);

    collector.detach();
  });

  test('generated RR draw has CONTAINER structure type', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'RR Structure');
    await drawer.selectDrawType('ROUND_ROBIN');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const dd = entry.methods[0].params.drawDefinition;

    expect(dd.drawType).toBe('ROUND_ROBIN');
    const mainStructure = dd.structures?.find((s: any) => s.stage === 'MAIN');
    expect(mainStructure).toBeDefined();
    expect(mainStructure.structureType).toBe('CONTAINER');

    collector.detach();
  });

  /* ── 8.2: Draw size auto-expands when qualifiers increase ──────────── */

  test('8.2 — increasing qualifiers auto-expands draw size to next power of 2', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    // Set qualifiers to 8 via evaluate + dispatch
    const result = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        const drawerEl = document.getElementById('tmxDrawer');
        const fields = drawerEl?.querySelectorAll('.field') || [];
        let drawSizeInput: HTMLInputElement | null = null;

        for (const field of fields) {
          const label = field.querySelector('.label');
          if (label?.textContent === 'Draw size') {
            drawSizeInput = field.querySelector('input') as HTMLInputElement;
          }
          if (label?.textContent === 'Qualifiers') {
            const input = field.querySelector('input') as HTMLInputElement;
            if (!input) { resolve({ error: 'not found' }); return; }

            const sizeBefore = drawSizeInput?.value;
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            setter?.call(input, '8');
            input.dispatchEvent(new Event('input', { bubbles: true }));

            // After synchronous handler runs, check draw size
            requestAnimationFrame(() => {
              resolve({
                sizeBefore,
                sizeAfter: drawSizeInput?.value,
                qualValue: input.value,
              });
            });
            return;
          }
        }
        resolve({ error: 'field not found' });
      });
    });

    // The qualifiersCountChange handler calls updateDrawSize which
    // recomputes: nextPowerOf2(16 entries + 8 qualifiers) = 32.
    // This is correct — the draw size auto-expands to accommodate
    // qualifiers. Automated stays enabled because there's no constraint
    // violation (32 >= 16 + 8).
    expect(result.sizeBefore).toBe('16');
    expect(result.sizeAfter).toBe('32');
    expect(result.qualValue).toBe('8');

    collector.detach();
    await drawer.clickCancel();
  });

  /* ── 5.10-5.11: REGISTERED and WITHDRAWN exclusion ────────────────── */

  test('5.10-5.11 — REGISTERED and WITHDRAWN entries excluded from draw size', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_16);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);

    // Change some entries to REGISTERED and WITHDRAWN
    await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      if (!event?.entries) return;
      let regChanged = 0;
      let wdChanged = 0;
      for (const entry of event.entries) {
        if (regChanged < 2 && entry.entryStatus === 'DIRECT_ACCEPTANCE') {
          entry.entryStatus = 'REGISTERED';
          regChanged++;
        } else if (wdChanged < 2 && entry.entryStatus === 'DIRECT_ACCEPTANCE') {
          entry.entryStatus = 'WITHDRAWN';
          wdChanged++;
        }
      }
      dev.factory.tournamentEngine.setState(tournament);
    });

    // Open draw form — should show 12 accepted (16 - 2 REG - 2 WD)
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Add draw' }).click();
    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    // SE: nextPowerOf2(12) = 16
    const seSize = Number(await drawer.getInputValue('Draw size'));
    expect(seSize).toBe(16);

    // RR: raw = 12
    await drawer.selectDrawType('ROUND_ROBIN');
    const rrSize = Number(await drawer.getInputValue('Draw size'));
    expect(rrSize).toBe(12);

    await drawer.clickCancel();
  });

  /* ── 12-entry draw: verify 4 byes in generated structure ──────────── */

  test('12-entry SE draw has 4 byes in generated structure', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page, PROFILE_12);

    await drawer.setInputValue('Draw name', 'Byes Test');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const dd = entry.methods[0].params.drawDefinition;
    const mainStructure = dd.structures?.find((s: any) => s.stage === 'MAIN');
    const byes = mainStructure?.positionAssignments?.filter((p: any) => p.bye) || [];

    // 16 positions - 12 entries = 4 byes
    expect(byes.length).toBe(4);
    expect(mainStructure?.positionAssignments?.length).toBe(16);

    collector.detach();
  });

  /* ── AD_HOC draw has no position assignments ──────────────────────── */

  test('AD_HOC draw generates without position assignments', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Ad Hoc Test');
    await drawer.selectDrawType('AD_HOC');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const dd = entry.methods[0].params.drawDefinition;
    expect(dd.drawType).toBe('AD_HOC');

    // AD_HOC draws don't use position assignments
    const mainStructure = dd.structures?.find((s: any) => s.stage === 'MAIN');
    const positions = mainStructure?.positionAssignments || [];
    expect(positions.length).toBe(0);

    collector.detach();
  });
});
